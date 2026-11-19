package dev.fluffymemory.commerce;

import dev.fluffymemory.ApiException;
import dev.fluffymemory.account.AccountService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;
import java.util.Locale;

import static dev.fluffymemory.commerce.CommerceModels.*;

@RestController
@RequestMapping("/api")
class CommerceController {
    private final AccountService accounts;
    private final CatalogService catalog;
    private final CartService cart;
    private final OrderService orders;

    CommerceController(AccountService accounts, CatalogService catalog, CartService cart, OrderService orders) {
        this.accounts = accounts;
        this.catalog = catalog;
        this.cart = cart;
        this.orders = orders;
    }

    @GetMapping("/products")
    List<Product> products(@RequestParam(required = false) String q, @RequestParam(required = false) String category) {
        return catalog.list(q, parseCategory(category), false);
    }

    @GetMapping("/products/{id}")
    Product product(@PathVariable long id) {
        return catalog.get(id, false);
    }

    @GetMapping("/cart")
    List<CartItem> cart(Principal principal) {
        return cart.list(accountId(principal));
    }

    @PostMapping("/cart")
    @ResponseStatus(HttpStatus.CREATED)
    CartItem add(Principal principal, @RequestBody LineInput input) {
        return cart.add(accountId(principal), input);
    }

    @PutMapping("/cart/{id}")
    CartItem update(Principal principal, @PathVariable long id, @RequestBody QuantityInput input) {
        return cart.update(accountId(principal), id, input);
    }

    @DeleteMapping("/cart/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(Principal principal, @PathVariable long id) {
        cart.delete(accountId(principal), id);
    }

    @GetMapping("/orders")
    List<Order> orders(Principal principal) {
        return orders.list(accountId(principal));
    }

    @GetMapping("/orders/{id}")
    Order order(Principal principal, @PathVariable long id) {
        return orders.get(accountId(principal), id);
    }

    @PostMapping("/orders")
    @ResponseStatus(HttpStatus.CREATED)
    Order checkout(Principal principal, @RequestBody CheckoutInput input) {
        return orders.checkout(accountId(principal), input);
    }

    @PostMapping("/orders/{id}/pay")
    Order pay(Principal principal, @PathVariable long id) {
        return orders.pay(accountId(principal), id);
    }

    @PostMapping("/orders/{id}/cancel")
    Order cancel(Principal principal, @PathVariable long id) {
        return orders.cancel(accountId(principal), id);
    }

    @PostMapping("/orders/{id}/receive")
    Order receive(Principal principal, @PathVariable long id) {
        return orders.receive(accountId(principal), id);
    }

    @PostMapping("/orders/{id}/refund")
    Order refund(Principal principal, @PathVariable long id, @RequestBody RefundInput input) {
        return orders.requestRefund(accountId(principal), id, input);
    }

    @GetMapping("/admin/products")
    List<Product> adminProducts() {
        return catalog.list(null, null, true);
    }

    @PostMapping("/admin/products")
    @ResponseStatus(HttpStatus.CREATED)
    Product adminCreate(Principal principal, @RequestBody ProductInput input) {
        return catalog.create(accountId(principal), input);
    }

    @PutMapping("/admin/products/{id}")
    Product adminUpdate(Principal principal, @PathVariable long id, @RequestBody ProductInput input) {
        return catalog.update(accountId(principal), id, input);
    }

    @GetMapping("/admin/orders")
    List<Order> adminOrders() {
        return orders.list(null);
    }

    @GetMapping("/admin/orders/{id}")
    Order adminOrder(@PathVariable long id) {
        return orders.get(null, id);
    }

    @PostMapping("/admin/orders/{id}/ship")
    Order adminShip(Principal principal, @PathVariable long id, @RequestBody ShipmentInput input) {
        return orders.ship(accountId(principal), id, input);
    }

    @PostMapping("/admin/orders/{id}/production")
    Order adminProduction(Principal principal, @PathVariable long id, @RequestBody ProductionInput input) {
        return orders.production(accountId(principal), id, input);
    }

    @PostMapping("/admin/orders/{id}/refund")
    Order adminRefund(Principal principal, @PathVariable long id, @RequestBody RefundDecision input) {
        return orders.resolveRefund(accountId(principal), id, input);
    }

    private long accountId(Principal principal) {
        return accounts.require(principal.getName()).id();
    }

    private Category parseCategory(String input) {
        if (input == null || input.isBlank()) {
            return null;
        }
        try {
            return Category.valueOf(input.strip().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            throw ApiException.badRequest("商品分类无效");
        }
    }
}
