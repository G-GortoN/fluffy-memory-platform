package dev.fluffymemory.care;

import dev.fluffymemory.ApiException;
import dev.fluffymemory.account.AdminAuditLog;
import dev.fluffymemory.pet.PetService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CareService {
    private final JdbcClient database;
    private final AdminAuditLog audit;

    public CareService(JdbcClient database, AdminAuditLog audit) {
        this.database = database;
        this.audit = audit;
    }

    public record Card(long id, String title, String summary, String body, String sourceUrl, Long productId,
                       String species, String stage, String breed, boolean published) {}

    public record Edit(@NotBlank @Size(max = 150) String title,
                       @NotBlank @Size(max = 500) String summary,
                       @NotBlank @Size(max = 6000) String body,
                       @NotBlank @Size(max = 1000) String sourceUrl,
                       @Positive Long productId,
                       @NotNull @Pattern(regexp = "ALL|CAT|DOG") String species,
                       @NotNull @Pattern(regexp = "ALL|YOUNG|ADULT|SENIOR") String stage,
                       @Size(max = 80) String breed,
                       boolean published) {}

    public List<Card> forPet(PetService.Pet pet) {
        if (!"ACTIVE".equals(pet.status())) {
            return List.of();
        }
        return database.sql("""
            SELECT card.*, product.id AS visible_product_id FROM care_cards card
            LEFT JOIN products product ON product.id = card.product_id AND product.active
            WHERE card.published AND (card.species = 'ALL' OR card.species = :species)
              AND (card.stage = 'ALL' OR card.stage = :stage)
              AND (card.breed IS NULL OR lower(card.breed) = lower(:breed))
            ORDER BY (card.breed IS NOT NULL) DESC, (card.species <> 'ALL') DESC, (card.stage <> 'ALL') DESC, card.id
            """)
            .param("species", pet.species())
            .param("stage", stage(pet))
            .param("breed", pet.breed())
            .query((row, index) -> row(row, "visible_product_id"))
            .list();
    }

    public List<Card> list() {
        return database.sql("SELECT * FROM care_cards ORDER BY id DESC").query(CareService::row).list();
    }

    @Transactional
    public Card create(Edit edit, long operatorId) {
        Card card = fields(database.sql("""
                INSERT INTO care_cards(title, summary, body, source_url, product_id, species, stage, breed, published)
                VALUES (:title, :summary, :body, :source, :product, :species, :stage, :breed, :published) RETURNING *
                """), edit)
            .query(CareService::row)
            .single();
        audit.record(operatorId, "CREATE", "CARE_CARD", card.id());
        return card;
    }

    @Transactional
    public Card update(long id, Edit edit, long operatorId) {
        Card card = fields(database.sql("""
                UPDATE care_cards SET title = :title, summary = :summary, body = :body, source_url = :source,
                    product_id = :product, species = :species, stage = :stage, breed = :breed,
                    published = :published, updated_at = now()
                WHERE id = :id RETURNING *
                """), edit)
            .param("id", id)
            .query(CareService::row)
            .optional()
            .orElseThrow(() -> ApiException.notFound("照护内容不存在"));
        audit.record(operatorId, "UPDATE", "CARE_CARD", id);
        return card;
    }

    private static String stage(PetService.Pet pet) {
        if (pet.ageMonths() < 12) {
            return "YOUNG";
        }
        int olderAgeMonths = "CAT".equals(pet.species()) ? 120 : 96;
        return pet.ageMonths() >= olderAgeMonths ? "SENIOR" : "ADULT";
    }

    private static JdbcClient.StatementSpec fields(JdbcClient.StatementSpec sql, Edit edit) {
        return sql.param("title", edit.title().strip())
            .param("summary", edit.summary().strip())
            .param("body", edit.body().strip())
            .param("source", source(edit.sourceUrl().strip()))
            .param("product", edit.productId())
            .param("species", edit.species())
            .param("stage", edit.stage())
            .param("breed", edit.breed() == null || edit.breed().isBlank() ? null : edit.breed().strip())
            .param("published", edit.published());
    }

    private static String source(String url) {
        try {
            URI uri = URI.create(url);
            if ("https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null && uri.getRawUserInfo() == null) {
                return url;
            }
        } catch (IllegalArgumentException invalid) {
            // The same validation message applies to malformed and unsupported addresses.
        }
        throw ApiException.badRequest("请输入有效的 HTTPS 来源链接");
    }

    private static Card row(ResultSet row, int index) throws SQLException {
        return row(row, "product_id");
    }

    private static Card row(ResultSet row, String productColumn) throws SQLException {
        return new Card(row.getLong("id"), row.getString("title"), row.getString("summary"), row.getString("body"),
            row.getString("source_url"), row.getObject(productColumn, Long.class), row.getString("species"),
            row.getString("stage"), row.getString("breed"), row.getBoolean("published"));
    }
}
