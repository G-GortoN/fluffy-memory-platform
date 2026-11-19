package dev.fluffymemory.commerce;

import dev.fluffymemory.ApiException;
import dev.fluffymemory.media.MediaService;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static dev.fluffymemory.commerce.CommerceModels.*;
import static dev.fluffymemory.commerce.CommerceRules.*;

@Service
class CartService {
    private static final String ITEMS = """
        select c.id, c.variant_id, c.quantity, c.custom_text, c.custom_photo_url,
               p.id as product_id, p.name as product_name, v.name as variant_name,
               v.price_cents, p.image_url, v.stock, p.active and v.active as active, p.custom
        from cart_items c
        join product_variants v on v.id = c.variant_id
        join products p on p.id = v.product_id
        where c.account_id = :owner
        """;

    private final JdbcClient db;
    private final CatalogService catalog;
    private final MediaService media;

    CartService(JdbcClient db, CatalogService catalog, MediaService media) {
        this.db = db;
        this.catalog = catalog;
        this.media = media;
    }

    List<CartItem> list(long ownerId) {
        return db.sql(ITEMS + " order by c.id").param("owner", ownerId).query(CartItem.class).list();
    }

    @Transactional
    CartItem add(long ownerId, LineInput input) {
        long variantId = validVariantId(input);
        lockOwner(ownerId);
        var variant = catalog.variant(variantId);
        LineInput line = normalizeLine(ownerId, input, variant);
        if (line.quantity() > variant.stock()) {
            throw ApiException.conflict("库存不足，可购买 " + variant.stock() + " 件");
        }
        int size = db.sql("select count(*) from cart_items where account_id = :owner")
            .param("owner", ownerId).query(Integer.class).single();
        if (size >= MAX_LINES) {
            throw ApiException.conflict("购物车已满");
        }
        long id = db.sql("""
            insert into cart_items (account_id, variant_id, quantity, custom_text, custom_photo_url)
            values (:owner, :variant, :quantity, :text, :photo) returning id
            """).param("owner", ownerId).param("variant", variantId).param("quantity", line.quantity())
            .param("text", line.customText()).param("photo", line.customPhotoUrl()).query(Long.class).single();
        return get(ownerId, id);
    }

    @Transactional
    CartItem update(long ownerId, long id, QuantityInput input) {
        int quantity = quantity(input.quantity());
        lockOwner(ownerId);
        CartItem item = get(ownerId, id);
        if (!item.active() || quantity > item.stock()) {
            throw ApiException.conflict("该商品当前库存不足或已下架");
        }
        db.sql("update cart_items set quantity = :quantity where id = :id and account_id = :owner")
            .param("quantity", quantity).param("id", id).param("owner", ownerId).update();
        return get(ownerId, id);
    }

    @Transactional
    void delete(long ownerId, long id) {
        lockOwner(ownerId);
        int removed = db.sql("delete from cart_items where id = :id and account_id = :owner")
            .param("id", id).param("owner", ownerId).update();
        if (removed == 0) {
            throw ApiException.notFound("购物车商品不存在");
        }
    }

    void lockOwner(long ownerId) {
        db.sql("select id from accounts where id = :owner for no key update")
            .param("owner", ownerId).query(Long.class).single();
    }

    private CartItem get(long ownerId, long id) {
        return db.sql(ITEMS + " and c.id = :id").param("owner", ownerId).param("id", id)
            .query(CartItem.class).optional().orElseThrow(() -> ApiException.notFound("购物车商品不存在"));
    }

    long validVariantId(LineInput line) {
        if (line == null || line.variantId() == null || line.variantId() < 1) {
            throw ApiException.badRequest("请选择有效的商品规格");
        }
        return line.variantId();
    }

    LineInput normalizeLine(long ownerId, LineInput line, CatalogService.SellableVariant variant) {
        if (!variant.active()) {
            throw ApiException.conflict(variant.productName() + "已下架");
        }
        int quantity = quantity(line.quantity());
        String text = optionalText(line.customText(), 120, "定制文字");
        String photo = optionalText(line.customPhotoUrl(), 200, "定制照片地址");
        if (!variant.custom() && (text != null || photo != null)) {
            throw ApiException.badRequest("该商品使用标准规格");
        }
        if (variant.custom() && text == null && photo == null) {
            throw ApiException.badRequest("请填写定制文字或上传照片");
        }
        if (photo != null) {
            photo = media.requireOwnedPhoto(photo, ownerId);
        }
        return new LineInput(variant.id(), quantity, text, photo);
    }
}
