package dev.fluffymemory.commerce;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
class OrderExpiryJob {
    private final OrderService orders;

    OrderExpiryJob(OrderService orders) {
        this.orders = orders;
    }

    @Scheduled(fixedDelay = 15_000, initialDelay = 15_000)
    void releaseExpiredReservations() {
        orders.dueOrders().forEach(orders::expire);
    }
}
