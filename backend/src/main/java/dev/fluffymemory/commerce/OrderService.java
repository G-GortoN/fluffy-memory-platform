package dev.fluffymemory.commerce;

import dev.fluffymemory.ApiException;
import dev.fluffymemory.account.AdminAuditLog;
import dev.fluffymemory.media.MediaService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

import static dev.fluffymemory.commerce.CommerceModels.*;
import static dev.fluffymemory.commerce.CommerceRules.*;

@Service
class OrderService {
    private static final Set<Status> REFUNDABLE = Set.of(Status.PAID, Status.PARTIALLY_SHIPPED, Status.SHIPPED, Status.COMPLETED);
    private static final Set<Status> FULFILLABLE = Set.of(Status.PAID, Status.PARTIALLY_SHIPPED);

    private final JdbcClient db;
    private final CartService cart;
    private final CatalogService catalog;
    private final MediaService media;
    private final AdminAuditLog audit;
    private final boolean simulatedPayments;

    OrderService(JdbcClient db, CartService cart, CatalogService catalog, MediaService media,
                 AdminAuditLog audit, @Value("${app.simulated-payments:false}") boolean simulatedPayments) {
        this.db = db;
        this.cart = cart;
        this.catalog = catalog;
        this.media = media;
        this.audit = audit;
        this.simulatedPayments = simulatedPayments;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    List<Order> list(Long ownerId) {
        var statement = ownerId == null
            ? db.sql("select * from orders order by id desc")
            : db.sql("select * from orders where account_id = :owner order by id desc").param("owner", ownerId);
        return attachDetails(statement.query(this::readHeader).list());
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    Order get(Long ownerId, long orderId) {
        return getDetails(find(ownerId, orderId, false));
    }

    @Transactional
    Order checkout(long ownerId, CheckoutInput request) {
        String requestId = requiredText(request.requestId(), 100, "结算标识");
        cart.lockOwner(ownerId);
        var previous = db.sql("select * from orders where account_id = :owner and request_id = :request")
            .param("owner", ownerId).param("request", requestId).query(this::readHeader).optional();
        if (previous.isPresent()) {
            return getDetails(previous.get());
        }

        String recipient = requiredText(request.recipient(), 60, "收货人姓名");
        String phone = requiredText(request.phone(), 32, "联系电话");
        String address = requiredText(request.address(), 300, "收货地址");
        CheckoutLines selection = selectLines(ownerId, request);
        List<LineInput> lines = selection.items();
        Set<Long> variantIds = lines.stream().map(cart::validVariantId).collect(Collectors.toSet());
        Map<Long, CatalogService.SellableVariant> variants = catalog.lockVariants(variantIds);
        List<LineInput> validated = lines.stream()
            .map(line -> cart.normalizeLine(ownerId, line, variants.get(line.variantId()))).toList();
        reserveStock(validated, variants);

        long subtotal = validated.stream().mapToLong(line -> (long) variants.get(line.variantId()).priceCents() * line.quantity()).sum();
        long orderId = db.sql("""
            insert into orders (account_id, request_id, status, subtotal_cents, shipping_cents,
                                recipient, phone, address, expires_at)
            values (:owner, :request, 'PENDING_PAYMENT', :subtotal, 0, :recipient, :phone, :address,
                    clock_timestamp() + interval '30 minutes') returning id
            """).param("owner", ownerId).param("request", requestId).param("subtotal", subtotal)
            .param("recipient", recipient).param("phone", phone).param("address", address)
            .query(Long.class).single();

        for (LineInput line : validated) {
            saveItem(ownerId, orderId, line, variants.get(line.variantId()));
        }
        if (!selection.cartIds().isEmpty()) {
            db.sql("delete from cart_items where account_id = :owner and id in (:ids)")
                .param("owner", ownerId).param("ids", selection.cartIds()).update();
        }
        return getDetails(find(ownerId, orderId, false));
    }

    private CheckoutLines selectLines(long ownerId, CheckoutInput request) {
        if (request.items() != null) {
            if (request.cartIds() != null || request.items().isEmpty() || request.items().size() > MAX_LINES) {
                throw ApiException.badRequest("请选择 1 至 " + MAX_LINES + " 个直接购买商品，或使用购物车结算");
            }
            return new CheckoutLines(request.items(), List.of());
        }
        List<CartItem> selected = cart.list(ownerId);
        if (request.cartIds() != null) {
            Set<Long> ids = selection(request.cartIds(), "购物车商品");
            selected = selected.stream().filter(item -> ids.contains(item.id())).toList();
            if (selected.size() != ids.size()) {
                throw ApiException.notFound("部分购物车商品已失效，请刷新后重新结算");
            }
        }
        if (selected.isEmpty()) {
            throw ApiException.badRequest("请选择要购买的商品");
        }
        return new CheckoutLines(selected.stream().map(CartItem::orderInput).toList(),
            selected.stream().map(CartItem::id).toList());
    }

    private void reserveStock(List<LineInput> lines, Map<Long, CatalogService.SellableVariant> variants) {
        Map<Long, Integer> quantities = new TreeMap<>();
        for (LineInput line : lines) {
            quantities.merge(line.variantId(), line.quantity(), Integer::sum);
        }
        for (var entry : quantities.entrySet()) {
            var variant = variants.get(entry.getKey());
            int quantity = entry.getValue();
            if (quantity > variant.stock()) {
                throw ApiException.conflict(variant.productName() + "库存不足，可购买 " + variant.stock() + " 件");
            }
            db.sql("update product_variants set stock = stock - :quantity where id = :id")
                .param("quantity", quantity).param("id", variant.id()).update();
        }
    }

    private void saveItem(long ownerId, long orderId, LineInput line, CatalogService.SellableVariant variant) {
        String production = variant.custom() ? ProductionStatus.AWAITING_PAYMENT.name() : ProductionStatus.NOT_REQUIRED.name();
        db.sql("""
            insert into order_items (order_id, product_id, variant_id, product_name, variant_name,
                                     price_cents, quantity, custom_text, custom_photo_url, production_status)
            values (:order, :product, :variant, :productName, :variantName, :price, :quantity,
                    :text, :photo, :production)
            """).param("order", orderId).param("product", variant.productId()).param("variant", variant.id())
            .param("productName", variant.productName()).param("variantName", variant.variantName())
            .param("price", variant.priceCents()).param("quantity", line.quantity()).param("text", line.customText())
            .param("photo", line.customPhotoUrl()).param("production", production).update();
        if (line.customPhotoUrl() != null) {
            media.allowOperations(line.customPhotoUrl(), ownerId);
        }
    }

    @Transactional
    Order pay(long ownerId, long orderId) {
        if (!simulatedPayments) {
            throw ApiException.conflict("当前环境尚未开放在线支付");
        }
        OrderHeader order = find(ownerId, orderId, true);
        if (order.paidAt() != null) {
            return getDetails(order);
        }
        requireStatus(order, Status.PENDING_PAYMENT, "仅待支付订单可付款");
        if (!order.expiresAt().isAfter(Instant.now())) {
            cancelPending(orderId);
            return getDetails(find(ownerId, orderId, false));
        }
        db.sql("update orders set status = 'PAID', paid_at = clock_timestamp() where id = :order")
            .param("order", orderId).update();
        db.sql("""
            update order_items set production_status = 'QUEUED'
            where order_id = :order and production_status = 'AWAITING_PAYMENT'
            """).param("order", orderId).update();
        return getDetails(find(ownerId, orderId, false));
    }

    @Transactional
    Order cancel(long ownerId, long orderId) {
        OrderHeader order = find(ownerId, orderId, true);
        if (order.status() == Status.CANCELLED) {
            return getDetails(order);
        }
        requireStatus(order, Status.PENDING_PAYMENT, "已付款订单可发起售后申请");
        cancelPending(orderId);
        return getDetails(find(ownerId, orderId, false));
    }

    @Transactional
    Order receive(long ownerId, long orderId) {
        OrderHeader order = find(ownerId, orderId, true);
        if (order.status() == Status.COMPLETED) {
            return getDetails(order);
        }
        requireStatus(order, Status.SHIPPED, "全部商品发货后才可确认收货");
        setStatus(orderId, Status.COMPLETED);
        return getDetails(find(ownerId, orderId, false));
    }

    @Transactional
    Order requestRefund(long ownerId, long orderId, RefundInput input) {
        OrderHeader order = find(ownerId, orderId, true);
        if (order.status() == Status.REFUND_REQUESTED) {
            return getDetails(order);
        }
        if (!REFUNDABLE.contains(order.status())) {
            throw ApiException.conflict("订单当前无法申请退款");
        }
        String reason = requiredText(input.reason(), 500, "退款原因");
        db.sql("""
            update orders set status = 'REFUND_REQUESTED', refund_reason = :reason, refund_from_status = :previous
            where id = :order
            """).param("reason", reason).param("previous", order.status().name()).param("order", orderId).update();
        return getDetails(find(ownerId, orderId, false));
    }

    @Transactional
    Order resolveRefund(long adminId, long orderId, RefundDecision input) {
        if (input.approve() == null) {
            throw ApiException.badRequest("请选择退款处理结果");
        }
        OrderHeader order = find(null, orderId, true);
        if (input.approve() && order.status() == Status.REFUNDED) {
            return getDetails(order);
        }
        requireStatus(order, Status.REFUND_REQUESTED, "订单当前没有待处理的退款申请");
        if (input.approve()) {
            returnUnshippedStock(orderId);
            cancelUnshippedProduction(orderId);
            db.sql("""
                update orders set status = 'REFUNDED', refunded_at = clock_timestamp(), refund_from_status = null
                where id = :order
                """).param("order", orderId).update();
        } else {
            db.sql("""
                update orders set status = refund_from_status, refund_from_status = null, refund_reason = null
                where id = :order
                """).param("order", orderId).update();
        }
        audit.record(adminId, input.approve() ? "APPROVE_REFUND" : "REJECT_REFUND", "ORDER", orderId);
        return getDetails(find(null, orderId, false));
    }

    @Transactional
    Order ship(long adminId, long orderId, ShipmentInput input) {
        String carrier = requiredText(input.carrier(), 60, "物流公司");
        String trackingNo = requiredText(input.trackingNo(), 80, "运单号");
        OrderHeader header = find(null, orderId, true);
        Order order = getDetails(header);
        var existing = order.shipments().stream()
            .filter(shipment -> shipment.carrier().equals(carrier) && shipment.trackingNo().equals(trackingNo)).findFirst();
        Set<Long> selected = input.itemIds() == null ? null : selection(input.itemIds(), "订单商品");
        if (existing.isPresent()) {
            long shipmentId = existing.get().id();
            Set<Long> shippedIds = order.items().stream().filter(item -> Long.valueOf(shipmentId).equals(item.shipmentId()))
                .map(OrderItem::id).collect(Collectors.toSet());
            if (selected == null || selected.equals(shippedIds)) {
                return order;
            }
            throw ApiException.conflict("该运单号已关联其他订单商品");
        }
        if (!FULFILLABLE.contains(order.status())) {
            throw ApiException.conflict("订单当前无法发货");
        }
        List<OrderItem> unshipped = order.items().stream().filter(item -> item.shipmentId() == null).toList();
        List<OrderItem> items = selected == null ? unshipped : unshipped.stream().filter(item -> selected.contains(item.id())).toList();
        if (items.isEmpty() || (selected != null && items.size() != selected.size())) {
            throw ApiException.badRequest("请只选择该订单中尚未发货的商品");
        }
        if (items.stream().anyMatch(item -> item.productionStatus() != ProductionStatus.NOT_REQUIRED
            && item.productionStatus() != ProductionStatus.READY)) {
            throw ApiException.conflict("请选择已经完成制作的定制品");
        }
        long shipment = db.sql("""
            insert into shipments (order_id, carrier, tracking_no) values (:order, :carrier, :tracking) returning id
            """).param("order", orderId).param("carrier", carrier).param("tracking", trackingNo)
            .query(Long.class).single();
        db.sql("update order_items set shipment_id = :shipment where order_id = :order and id in (:items)")
            .param("shipment", shipment).param("order", orderId).param("items", items.stream().map(OrderItem::id).toList()).update();
        setStatus(orderId, items.size() == unshipped.size() ? Status.SHIPPED : Status.PARTIALLY_SHIPPED);
        audit.record(adminId, "SHIP_ORDER", "ORDER", orderId);
        return getDetails(find(null, orderId, false));
    }

    @Transactional
    Order production(long adminId, long orderId, ProductionInput input) {
        if (input.itemId() == null || input.itemId() < 1
            || (input.status() != ProductionStatus.IN_PRODUCTION && input.status() != ProductionStatus.READY)) {
            throw ApiException.badRequest("请选择定制商品与制作状态");
        }
        OrderHeader header = find(null, orderId, true);
        Order result = getDetails(header);
        OrderItem item = result.items().stream().filter(row -> row.id() == input.itemId()).findFirst()
            .orElseThrow(() -> ApiException.notFound("订单商品不存在"));
        if (item.productionStatus() == input.status()) {
            return result;
        }
        if (!FULFILLABLE.contains(result.status()) || item.shipmentId() != null
            || item.productionStatus() == ProductionStatus.READY || item.productionStatus() == ProductionStatus.NOT_REQUIRED) {
            throw ApiException.conflict("订单商品当前无法更新制作状态");
        }
        db.sql("update order_items set production_status = :status where id = :id and order_id = :order")
            .param("status", input.status().name()).param("id", input.itemId()).param("order", orderId).update();
        audit.record(adminId, "UPDATE_PRODUCTION", "ORDER", orderId);
        return getDetails(find(null, orderId, false));
    }

    List<Long> dueOrders() {
        return db.sql("""
            select id from orders where status = 'PENDING_PAYMENT' and expires_at <= clock_timestamp()
            order by expires_at limit 30
            """).query(Long.class).list();
    }

    @Transactional
    void expire(long orderId) {
        boolean due = db.sql("""
            select id from orders where id = :id and status = 'PENDING_PAYMENT' and expires_at <= clock_timestamp()
            for update skip locked
            """).param("id", orderId).query(Long.class).optional().isPresent();
        if (due) {
            cancelPending(orderId);
        }
    }

    private void cancelPending(long orderId) {
        returnUnshippedStock(orderId);
        cancelUnshippedProduction(orderId);
        setStatus(orderId, Status.CANCELLED);
    }

    private void returnUnshippedStock(long orderId) {
        // Order row is already locked. Update variant rows by ID as checkout does.
        List<StockReturn> released = db.sql("""
            select variant_id, sum(quantity)::integer as quantity from order_items
            where order_id = :order and shipment_id is null group by variant_id order by variant_id
            """).param("order", orderId).query(StockReturn.class).list();
        for (StockReturn item : released) {
            db.sql("update product_variants set stock = stock + :quantity where id = :variant")
                .param("quantity", item.quantity()).param("variant", item.variantId()).update();
        }
    }

    private void cancelUnshippedProduction(long orderId) {
        db.sql("""
            update order_items set production_status = 'CANCELLED'
            where order_id = :order and shipment_id is null and production_status <> 'NOT_REQUIRED'
            """).param("order", orderId).update();
    }

    private void setStatus(long orderId, Status status) {
        db.sql("update orders set status = :status where id = :order")
            .param("status", status.name()).param("order", orderId).update();
    }

    private void requireStatus(OrderHeader order, Status status, String message) {
        if (order.status() != status) {
            throw ApiException.conflict(message);
        }
    }

    private OrderHeader find(Long ownerId, long orderId, boolean lock) {
        String sql = "select * from orders where id = :id";
        if (ownerId != null) {
            sql += " and account_id = :owner";
        }
        if (lock) {
            sql += " for update";
        }
        var query = db.sql(sql).param("id", orderId);
        if (ownerId != null) {
            query.param("owner", ownerId);
        }
        return query.query(this::readHeader).optional().orElseThrow(() -> ApiException.notFound("订单不存在"));
    }

    private Order getDetails(OrderHeader header) {
        return attachDetails(List.of(header)).getFirst();
    }

    private List<Order> attachDetails(List<OrderHeader> headers) {
        if (headers.isEmpty()) {
            return List.of();
        }
        List<Long> ids = headers.stream().map(OrderHeader::id).toList();
        Map<Long, List<OrderItem>> items = new HashMap<>();
        db.sql("select * from order_items where order_id in (:ids) order by id").param("ids", ids)
            .query((row, index) -> new OrderItemRow(row.getLong("order_id"), readItem(row))).list()
            .forEach(row -> items.computeIfAbsent(row.orderId(), ignored -> new ArrayList<>()).add(row.item()));
        Map<Long, List<Shipment>> shipments = new HashMap<>();
        db.sql("select * from shipments where order_id in (:ids) order by id").param("ids", ids)
            .query((row, index) -> new ShipmentRow(row.getLong("order_id"), readShipment(row))).list()
            .forEach(row -> shipments.computeIfAbsent(row.orderId(), ignored -> new ArrayList<>()).add(row.shipment()));
        return headers.stream().map(header -> header.details(items.getOrDefault(header.id(), List.of()),
            shipments.getOrDefault(header.id(), List.of()))).toList();
    }

    private OrderHeader readHeader(ResultSet row, int index) throws SQLException {
        return new OrderHeader(row.getLong("id"), Status.valueOf(row.getString("status")), row.getLong("subtotal_cents"),
            row.getInt("shipping_cents"), row.getString("recipient"), row.getString("phone"), row.getString("address"),
            instant(row, "created_at"), instant(row, "expires_at"), instant(row, "paid_at"), row.getString("refund_reason"));
    }

    private OrderItem readItem(ResultSet row) throws SQLException {
        return new OrderItem(row.getLong("id"), row.getLong("product_id"), row.getLong("variant_id"),
            row.getString("product_name"), row.getString("variant_name"), row.getInt("price_cents"), row.getInt("quantity"),
            row.getString("custom_text"), row.getString("custom_photo_url"),
            ProductionStatus.valueOf(row.getString("production_status")), row.getObject("shipment_id", Long.class));
    }

    private Shipment readShipment(ResultSet row) throws SQLException {
        return new Shipment(row.getLong("id"), row.getString("carrier"), row.getString("tracking_no"), instant(row, "shipped_at"));
    }

    private Instant instant(ResultSet row, String column) throws SQLException {
        OffsetDateTime value = row.getObject(column, OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }

    private record CheckoutLines(List<LineInput> items, List<Long> cartIds) {}
    private record StockReturn(long variantId, int quantity) {}
    private record OrderItemRow(long orderId, OrderItem item) {}
    private record ShipmentRow(long orderId, Shipment shipment) {}

    private record OrderHeader(long id, Status status, long subtotalCents, int shippingCents, String recipient,
                               String phone, String address, Instant createdAt, Instant expiresAt, Instant paidAt,
                               String refundReason) {
        Order details(List<OrderItem> items, List<Shipment> shipments) {
            return new Order(id, status, subtotalCents, shippingCents, subtotalCents + shippingCents,
                recipient, phone, address, createdAt, expiresAt, paidAt, refundReason, items, shipments);
        }
    }
}
