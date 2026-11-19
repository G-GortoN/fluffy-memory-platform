package dev.fluffymemory.commerce;

import java.time.Instant;
import java.util.List;

final class CommerceModels {
    private CommerceModels() {}

    enum Category {
        FOOD, WELLNESS, BOWLS, FRAMES, KEEPSAKES, URNS
    }

    enum Status {
        PENDING_PAYMENT, PAID, PARTIALLY_SHIPPED, SHIPPED, COMPLETED, CANCELLED, REFUND_REQUESTED, REFUNDED
    }

    enum ProductionStatus {
        NOT_REQUIRED, AWAITING_PAYMENT, QUEUED, IN_PRODUCTION, READY, CANCELLED
    }

    record Variant(long id, String name, int priceCents, int stock) {}

    record Product(long id, String name, String description, Category category, String imageUrl,
                   boolean custom, boolean active, List<Variant> variants) {}

    record VariantInput(Long id, String name, Integer priceCents, Integer stock, Integer expectedStock) {}

    record ProductInput(String name, String description, Category category, String imageUrl,
                        boolean custom, boolean active, List<VariantInput> variants) {}

    record LineInput(Long variantId, Integer quantity, String customText, String customPhotoUrl) {}

    record QuantityInput(Integer quantity) {}

    record CartItem(long id, long variantId, int quantity, String customText, String customPhotoUrl,
                    long productId, String productName, String variantName, int priceCents,
                    String imageUrl, int stock, boolean active, boolean custom) {
        LineInput orderInput() {
            return new LineInput(variantId, quantity, customText, customPhotoUrl);
        }
    }

    record CheckoutInput(List<Long> cartIds, List<LineInput> items, String recipient, String phone,
                         String address, String requestId) {}

    record RefundInput(String reason) {}

    record RefundDecision(Boolean approve) {}

    record ShipmentInput(String carrier, String trackingNo, List<Long> itemIds) {}

    record ProductionInput(Long itemId, ProductionStatus status) {}

    record Shipment(long id, String carrier, String trackingNo, Instant shippedAt) {}

    record OrderItem(long id, long productId, long variantId, String productName, String variantName,
                     int priceCents, int quantity, String customText, String customPhotoUrl,
                     ProductionStatus productionStatus, Long shipmentId) {}

    record Order(long id, Status status, long subtotalCents, int shippingCents, long totalCents,
                 String recipient, String phone, String address, Instant createdAt, Instant expiresAt,
                 Instant paidAt, String refundReason, List<OrderItem> items, List<Shipment> shipments) {}
}
