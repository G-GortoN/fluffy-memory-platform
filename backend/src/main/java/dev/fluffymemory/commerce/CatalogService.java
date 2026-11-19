package dev.fluffymemory.commerce;

import dev.fluffymemory.ApiException;
import dev.fluffymemory.account.AdminAuditLog;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import static dev.fluffymemory.commerce.CommerceModels.*;
import static dev.fluffymemory.commerce.CommerceRules.*;

@Service
class CatalogService {
    private static final String SELLABLE = """
        select v.id, v.product_id, v.name as variant_name, v.price_cents, v.stock,
               p.name as product_name, p.custom, p.active and v.active as active
        from product_variants v join products p on p.id = v.product_id
        """;

    private final JdbcClient db;
    private final AdminAuditLog audit;

    CatalogService(JdbcClient db, AdminAuditLog audit) {
        this.db = db;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    List<Product> list(String keyword, Category category, boolean admin) {
        String search = optionalText(keyword, 100, "搜索词");
        List<ProductRow> products = db.sql("""
            select * from products
            where (:admin or active)
              and (:category = '' or category = :category)
              and (name ilike :search or description ilike :search)
            order by id
            """)
            .param("admin", admin)
            .param("category", category == null ? "" : category.name())
            .param("search", search == null ? "%" : "%" + search + "%")
            .query(ProductRow.class).list();
        return attachVariants(products);
    }

    @Transactional(readOnly = true)
    Product get(long id, boolean admin) {
        ProductRow product = db.sql("select * from products where id = :id and (:admin or active)")
            .param("id", id).param("admin", admin).query(ProductRow.class).optional()
            .orElseThrow(() -> ApiException.notFound("商品暂不可用"));
        return attachVariants(List.of(product)).getFirst();
    }

    private List<Product> attachVariants(List<ProductRow> products) {
        if (products.isEmpty()) {
            return List.of();
        }
        Map<Long, List<Variant>> variants = db.sql("""
            select id, product_id, name, price_cents, stock
            from product_variants where active and product_id in (:ids) order by id
            """)
            .param("ids", products.stream().map(ProductRow::id).toList())
            .query(VariantRow.class).list().stream()
            .collect(Collectors.groupingBy(VariantRow::productId, Collectors.mapping(VariantRow::variant, Collectors.toList())));
        return products.stream().map(product -> product.withVariants(variants.getOrDefault(product.id(), List.of()))).toList();
    }

    @Transactional
    Product create(long adminId, ProductInput input) {
        ProductData values = validate(input);
        long id = productParams(db.sql("""
            insert into products (name, description, category, image_url, custom, active)
            values (:name, :description, :category, :imageUrl, :custom, :active) returning id
            """), values).query(Long.class).single();
        saveVariants(id, values.variants(), Map.of());
        audit.record(adminId, "CREATE_PRODUCT", "PRODUCT", id);
        return get(id, true);
    }

    @Transactional
    Product update(long adminId, long id, ProductInput input) {
        ProductData values = validate(input);
        int updated = productParams(db.sql("""
            update products
            set name = :name, description = :description, category = :category,
                image_url = :imageUrl, custom = :custom, active = :active
            where id = :id
            """), values).param("id", id).update();
        if (updated == 0) {
            throw ApiException.notFound("商品不存在");
        }
        Map<Long, VariantState> current = db.sql("""
            select id, stock, active from product_variants where product_id = :id order by id for update
            """).param("id", id).query(VariantState.class).list().stream()
            .collect(Collectors.toMap(VariantState::id, Function.identity()));
        saveVariants(id, values.variants(), current);
        audit.record(adminId, "UPDATE_PRODUCT", "PRODUCT", id);
        return get(id, true);
    }

    SellableVariant variant(long id) {
        return db.sql(SELLABLE + " where v.id = :id").param("id", id).query(SellableVariant.class).optional()
            .orElseThrow(() -> ApiException.notFound("商品规格不存在"));
    }

    Map<Long, SellableVariant> lockVariants(Set<Long> ids) {
        // Keep publication and price stable until inventory is reserved. Use the
        // same lock order as product editing, including during multi-product checkout.
        db.sql("""
            select p.id from products p
            where exists (select 1 from product_variants v where v.product_id = p.id and v.id in (:ids))
            order by p.id for update
            """).param("ids", ids).query(Long.class).list();
        List<SellableVariant> variants = db.sql(SELLABLE + " where v.id in (:ids) order by v.id for update of v")
            .param("ids", ids).query(SellableVariant.class).list();
        if (variants.size() != ids.size()) {
            throw ApiException.notFound("存在无效的商品规格");
        }
        Map<Long, SellableVariant> result = new HashMap<>();
        for (SellableVariant variant : variants) {
            result.put(variant.id(), variant);
        }
        return result;
    }

    private void saveVariants(long productId, List<VariantInput> variants, Map<Long, VariantState> current) {
        Set<Long> kept = new HashSet<>();
        for (VariantInput variant : variants) {
            if (variant.id() == null) {
                db.sql("""
                    insert into product_variants (product_id, name, price_cents, stock)
                    values (:productId, :name, :price, :stock)
                    """).param("productId", productId).param("name", variant.name())
                    .param("price", variant.priceCents()).param("stock", variant.stock()).update();
                continue;
            }
            if (!current.containsKey(variant.id()) || !kept.add(variant.id())) {
                throw ApiException.badRequest("规格不属于该商品或重复提交");
            }
            if (variant.expectedStock() != null && variant.expectedStock() != current.get(variant.id()).stock()) {
                throw ApiException.conflict("库存已更新，请刷新商品后再保存");
            }
            db.sql("""
                update product_variants set name = :name, price_cents = :price, stock = :stock, active = true
                where id = :id
                """).param("id", variant.id()).param("name", variant.name())
                .param("price", variant.priceCents()).param("stock", variant.stock()).update();
        }
        List<Long> removed = current.values().stream().filter(row -> row.active() && !kept.contains(row.id()))
            .map(VariantState::id).toList();
        if (!removed.isEmpty()) {
            db.sql("update product_variants set active = false where id in (:ids)").param("ids", removed).update();
        }
    }

    private ProductData validate(ProductInput input) {
        String name = requiredText(input.name(), 100, "商品名称");
        String description = requiredText(input.description(), 3000, "商品描述");
        Category category = input.category();
        if (category == null) {
            throw ApiException.badRequest("请选择商品分类");
        }
        String imageUrl = optionalText(input.imageUrl(), 500, "商品图片地址");
        if (imageUrl == null) {
            imageUrl = "/images/" + category.name().toLowerCase(Locale.ROOT) + ".webp";
        }
        if (!allowedImage(imageUrl)) {
            throw ApiException.badRequest("请使用站内商品图片或 HTTPS 图片地址");
        }
        if (input.variants() == null || input.variants().isEmpty() || input.variants().size() > 25) {
            throw ApiException.badRequest("商品须有 1 至 25 个规格");
        }
        List<VariantInput> variants = input.variants().stream().map(this::validateVariant).toList();
        return new ProductData(name, description, category, imageUrl, input.custom(), input.active(), variants);
    }

    private VariantInput validateVariant(VariantInput input) {
        if (input == null || input.priceCents() == null || input.priceCents() < 1 || input.priceCents() > 10_000_000
            || input.stock() == null || input.stock() < 0 || input.stock() > 1_000_000) {
            throw ApiException.badRequest("商品价格或库存超出允许范围");
        }
        String name = requiredText(input.name(), 80, "规格名称");
        return new VariantInput(input.id(), name, input.priceCents(), input.stock(), input.expectedStock());
    }

    private boolean allowedImage(String value) {
        if (value.startsWith("/images/")) {
            return value.matches("/images/[a-zA-Z0-9_./-]+") && !value.contains("..");
        }
        try {
            URI uri = URI.create(value);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null && uri.getUserInfo() == null;
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    private JdbcClient.StatementSpec productParams(JdbcClient.StatementSpec statement, ProductData values) {
        return statement.param("name", values.name()).param("description", values.description())
            .param("category", values.category().name()).param("imageUrl", values.imageUrl())
            .param("custom", values.custom()).param("active", values.active());
    }

    record SellableVariant(long id, long productId, String variantName, int priceCents, int stock,
                           String productName, boolean custom, boolean active) {}

    private record VariantState(long id, int stock, boolean active) {}

    private record VariantRow(long id, long productId, String name, int priceCents, int stock) {
        Variant variant() {
            return new Variant(id, name, priceCents, stock);
        }
    }

    private record ProductRow(long id, String name, String description, Category category,
                              String imageUrl, boolean custom, boolean active) {
        Product withVariants(List<Variant> variants) {
            return new Product(id, name, description, category, imageUrl, custom, active, variants);
        }
    }

    private record ProductData(String name, String description, Category category, String imageUrl,
                               boolean custom, boolean active, List<VariantInput> variants) {}
}
