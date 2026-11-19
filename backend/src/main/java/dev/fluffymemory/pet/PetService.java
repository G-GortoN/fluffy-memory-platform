package dev.fluffymemory.pet;

import dev.fluffymemory.ApiException;
import dev.fluffymemory.media.MediaService;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

@Service
public class PetService {
    private final JdbcClient database;
    private final MediaService media;

    public PetService(JdbcClient database, MediaService media) {
        this.database = database;
        this.media = media;
    }

    public record Pet(long id, String name, String species, String breed, int ageMonths, BigDecimal weightKg,
                      String status, String photoUrl) {}

    public record Edit(@NotBlank @Size(max = 80) String name,
                       @NotNull @Pattern(regexp = "CAT|DOG") String species,
                       @Size(max = 80) String breed,
                       @NotNull @Min(0) @Max(600) Integer ageMonths,
                       @DecimalMin("0.01") @DecimalMax("999.99") BigDecimal weightKg,
                       @Pattern(regexp = "ACTIVE|DECEASED") String status,
                       @Size(max = 100) String photoUrl) {}

    public List<Pet> list(long ownerId) {
        return database.sql("SELECT * FROM pets WHERE owner_id = :owner ORDER BY id DESC")
            .param("owner", ownerId)
            .query(PetService::row)
            .list();
    }

    public Pet get(long ownerId, long id) {
        return require(database.sql("SELECT * FROM pets WHERE owner_id = :owner AND id = :id")
            .param("owner", ownerId)
            .param("id", id)
            .query(PetService::row)
            .optional());
    }

    public Pet create(long ownerId, Edit edit) {
        UUID photo = media.requireOwnedId(edit.photoUrl(), ownerId);
        return editParams(database.sql("""
                INSERT INTO pets(owner_id, name, species, breed, age_months, weight_kg, status, photo_id)
                VALUES (:owner, :name, :species, :breed, :age, :weight, COALESCE(:status, 'ACTIVE'), :photo)
                RETURNING *
                """), ownerId, edit, photo)
            .query(PetService::row)
            .single();
    }

    public Pet update(long ownerId, long id, Edit edit) {
        UUID photo = media.requireOwnedId(edit.photoUrl(), ownerId);
        return require(editParams(database.sql("""
                UPDATE pets SET name = :name, species = :species, breed = :breed, age_months = :age,
                    weight_kg = :weight, status = COALESCE(:status, status), photo_id = :photo
                WHERE owner_id = :owner AND id = :id RETURNING *
                """), ownerId, edit, photo)
            .param("id", id)
            .query(PetService::row)
            .optional());
    }

    public Pet markDeceased(long ownerId, long id) {
        return require(database.sql("""
            UPDATE pets SET status = 'DECEASED' WHERE owner_id = :owner AND id = :id RETURNING *
            """)
            .param("owner", ownerId)
            .param("id", id)
            .query(PetService::row)
            .optional());
    }

    public void delete(long ownerId, long id) {
        int deleted = database.sql("DELETE FROM pets WHERE owner_id = :owner AND id = :id")
            .param("owner", ownerId)
            .param("id", id)
            .update();
        if (deleted == 0) {
            throw ApiException.notFound("宠物档案不存在");
        }
    }

    private static JdbcClient.StatementSpec editParams(JdbcClient.StatementSpec sql, long ownerId, Edit edit, UUID photo) {
        return sql.param("owner", ownerId)
            .param("name", edit.name().strip())
            .param("species", edit.species())
            .param("breed", edit.breed() == null || edit.breed().isBlank() ? null : edit.breed().strip())
            .param("age", edit.ageMonths())
            .param("weight", edit.weightKg())
            .param("status", edit.status())
            .param("photo", photo);
    }

    private static Pet require(Optional<Pet> pet) {
        return pet.orElseThrow(() -> ApiException.notFound("宠物档案不存在"));
    }

    private static Pet row(ResultSet row, int index) throws SQLException {
        return new Pet(row.getLong("id"), row.getString("name"), row.getString("species"), row.getString("breed"),
            row.getInt("age_months"), row.getBigDecimal("weight_kg"), row.getString("status"),
            MediaService.url(row.getObject("photo_id", UUID.class)));
    }
}
