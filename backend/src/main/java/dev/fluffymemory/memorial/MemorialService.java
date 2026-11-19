package dev.fluffymemory.memorial;

import dev.fluffymemory.ApiException;
import dev.fluffymemory.media.MediaService;
import dev.fluffymemory.pet.PetService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MemorialService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final java.util.regex.Pattern SHARE_TOKEN = java.util.regex.Pattern.compile("[A-Za-z0-9_-]{43}");

    private final JdbcClient database;
    private final PetService pets;
    private final MediaService media;

    public MemorialService(JdbcClient database, PetService pets, MediaService media) {
        this.database = database;
        this.pets = pets;
        this.media = media;
    }

    public record Memorial(long id, Long petId, String petName, String title, String story, String photoUrl,
                           String template, boolean shareEnabled, List<String> gallery, List<Moment> timeline) {}

    public record Edit(@Positive Long petId, @Size(max = 80) String petName,
                       @NotBlank @Size(max = 150) String title, @Size(max = 12_000) String story,
                       @Size(max = 100) String photoUrl, @Pattern(regexp = "CORNER|HALL") String template,
                       @Size(max = 20) List<@NotBlank @Size(max = 100) String> gallery,
                       @Size(max = 20) List<@NotNull @Valid Moment> timeline) {}

    public record Moment(@NotNull LocalDate date, @NotBlank @Size(max = 600) String text) {}

    private record Stored(long id, long ownerId, Long petId, String petName, String title, String story,
                          UUID photoId, String template, boolean shareEnabled) {}

    private record GalleryPhoto(int position, UUID id) {}

    public List<Memorial> list(long ownerId) {
        return database.sql("SELECT * FROM memorials WHERE owner_id = :owner ORDER BY id DESC")
            .param("owner", ownerId)
            .query(MemorialService::row)
            .list()
            .stream()
            .map(stored -> toMemorial(stored, null))
            .toList();
    }

    public Memorial get(long ownerId, long id) {
        return toMemorial(getOwned(ownerId, id), null);
    }

    @Transactional
    public Memorial create(long ownerId, Edit edit) {
        PetService.Pet pet = edit.petId() == null ? null : pets.markDeceased(ownerId, edit.petId());
        String petName = name(edit.petName(), pet == null ? null : pet.name());
        String photoUrl = edit.photoUrl() == null && pet != null ? pet.photoUrl() : edit.photoUrl();
        UUID photoId = media.requireOwnedId(photoUrl, ownerId);
        Stored stored = fields(database.sql("""
                INSERT INTO memorials(owner_id, pet_id, pet_name, title, story, photo_id, template)
                VALUES (:owner, :pet, :name, :title, :story, :photo, :template)
                ON CONFLICT (pet_id) DO NOTHING RETURNING *
                """), ownerId, edit, petName, photoId)
            .param("pet", edit.petId())
            .query(MemorialService::row)
            .optional()
            .orElseThrow(() -> ApiException.conflict("这只宠物已有纪念页"));
        updateDetails(stored, edit);
        return toMemorial(stored, null);
    }

    @Transactional
    public Memorial update(long ownerId, long id, Edit edit) {
        Stored current = getOwned(ownerId, id);
        if (edit.petId() != null && !edit.petId().equals(current.petId())) {
            throw ApiException.badRequest("请保留纪念页原有的宠物档案关联");
        }
        String petName = name(edit.petName(), current.petName());
        UUID photoId = media.requireOwnedId(edit.photoUrl(), ownerId);
        Stored saved = require(fields(database.sql("""
                UPDATE memorials SET pet_name = :name, title = :title, story = :story, photo_id = :photo, template = :template
                WHERE owner_id = :owner AND id = :id RETURNING *
                """), ownerId, edit, petName, photoId)
            .param("id", id)
            .query(MemorialService::row)
            .optional());
        updateDetails(saved, edit);
        return toMemorial(saved, null);
    }

    public void delete(long ownerId, long id) {
        int changed = database.sql("DELETE FROM memorials WHERE owner_id = :owner AND id = :id")
            .param("owner", ownerId)
            .param("id", id)
            .update();
        if (changed == 0) {
            throw missing();
        }
    }

    public String share(long ownerId, long id) {
        byte[] entropy = new byte[32];
        RANDOM.nextBytes(entropy);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(entropy);
        setShareHash(ownerId, id, hash(token));
        return token;
    }

    public void revoke(long ownerId, long id) {
        setShareHash(ownerId, id, null);
    }

    public Memorial getShared(String token) {
        return toMemorial(getSharedRow(token), token);
    }

    public ResponseEntity<Resource> getSharedCover(String token) {
        Stored stored = getSharedRow(token);
        if (stored.photoId() == null) {
            throw ApiException.notFound("照片不存在");
        }
        return media.readSharedPhoto(stored.photoId(), stored.ownerId());
    }

    public ResponseEntity<Resource> getSharedGalleryPhoto(String token, int position) {
        Stored stored = getSharedRow(token);
        UUID photoId = database.sql("SELECT photo_id FROM memorial_gallery WHERE memorial_id = :memorial AND position = :position")
            .param("memorial", stored.id())
            .param("position", position)
            .query(UUID.class)
            .optional()
            .orElseThrow(() -> ApiException.notFound("照片不存在"));
        return media.readSharedPhoto(photoId, stored.ownerId());
    }

    private Stored getOwned(long ownerId, long id) {
        return require(database.sql("SELECT * FROM memorials WHERE owner_id = :owner AND id = :id")
            .param("owner", ownerId)
            .param("id", id)
            .query(MemorialService::row)
            .optional());
    }

    private Stored getSharedRow(String token) {
        if (!SHARE_TOKEN.matcher(token).matches()) {
            throw missing();
        }
        return require(database.sql("SELECT * FROM memorials WHERE share_hash = :hash")
            .param("hash", hash(token))
            .query(MemorialService::row)
            .optional());
    }

    private void setShareHash(long ownerId, long id, String hash) {
        int changed = database.sql("UPDATE memorials SET share_hash = :hash WHERE owner_id = :owner AND id = :id")
            .param("hash", hash)
            .param("owner", ownerId)
            .param("id", id)
            .update();
        if (changed == 0) {
            throw missing();
        }
    }

    private void updateDetails(Stored stored, Edit edit) {
        if (edit.gallery() != null) {
            database.sql("DELETE FROM memorial_gallery WHERE memorial_id = :memorial")
                .param("memorial", stored.id()).update();
            List<UUID> photos = edit.gallery().stream()
                .map(path -> media.requireOwnedId(path, stored.ownerId()))
                .toList();
            for (int position = 0; position < photos.size(); position++) {
                database.sql("""
                    INSERT INTO memorial_gallery(memorial_id, position, photo_id) VALUES (:memorial, :position, :photo)
                    """)
                    .param("memorial", stored.id()).param("position", position).param("photo", photos.get(position))
                    .update();
            }
        }
        if (edit.timeline() != null) {
            database.sql("DELETE FROM memorial_timeline WHERE memorial_id = :memorial")
                .param("memorial", stored.id()).update();
            for (int position = 0; position < edit.timeline().size(); position++) {
                Moment moment = edit.timeline().get(position);
                database.sql("""
                    INSERT INTO memorial_timeline(memorial_id, position, moment_date, details)
                    VALUES (:memorial, :position, :date, :details)
                    """)
                    .param("memorial", stored.id()).param("position", position)
                    .param("date", moment.date()).param("details", moment.text().strip())
                    .update();
            }
        }
    }

    private Memorial toMemorial(Stored stored, String token) {
        String publicPath = token == null ? null : "/api/shared/" + token;
        List<String> gallery = database.sql("SELECT position, photo_id FROM memorial_gallery WHERE memorial_id = :id ORDER BY position")
            .param("id", stored.id())
            .query((row, index) -> new GalleryPhoto(row.getInt("position"), row.getObject("photo_id", UUID.class)))
            .list()
            .stream()
            .map(photo -> publicPath == null ? MediaService.url(photo.id()) : publicPath + "/gallery/" + photo.position())
            .toList();
        List<Moment> timeline = database.sql("SELECT moment_date, details FROM memorial_timeline WHERE memorial_id = :id ORDER BY position")
            .param("id", stored.id())
            .query((row, index) -> new Moment(row.getObject("moment_date", LocalDate.class), row.getString("details")))
            .list();
        String cover = MediaService.url(stored.photoId());
        if (publicPath != null && cover != null) {
            cover = publicPath + "/photo";
        }
        return new Memorial(stored.id(), publicPath == null ? stored.petId() : null,
            stored.petName(), stored.title(), stored.story(), cover, stored.template(), stored.shareEnabled(), gallery, timeline);
    }

    private static JdbcClient.StatementSpec fields(JdbcClient.StatementSpec query, long ownerId, Edit edit,
                                                   String petName, UUID photoId) {
        return query.param("owner", ownerId)
            .param("name", petName)
            .param("title", edit.title().strip())
            .param("story", edit.story() == null ? "" : edit.story().strip())
            .param("photo", photoId)
            .param("template", edit.template() == null ? "CORNER" : edit.template());
    }

    private static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException unavailable) {
            throw new IllegalStateException("SHA-256 is unavailable", unavailable);
        }
    }

    private static String name(String supplied, String fallback) {
        String name = supplied == null || supplied.isBlank() ? fallback : supplied.strip();
        if (name == null || name.isBlank()) {
            throw ApiException.badRequest("请输入宠物的名字");
        }
        return name;
    }

    private static Stored require(Optional<Stored> row) {
        return row.orElseThrow(MemorialService::missing);
    }

    private static ApiException missing() {
        return ApiException.notFound("纪念页不存在或已停止分享");
    }

    private static Stored row(ResultSet row, int index) throws SQLException {
        return new Stored(row.getLong("id"), row.getLong("owner_id"), row.getObject("pet_id", Long.class),
            row.getString("pet_name"), row.getString("title"), row.getString("story"),
            row.getObject("photo_id", UUID.class), row.getString("template"), row.getString("share_hash") != null);
    }
}
