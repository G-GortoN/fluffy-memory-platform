package dev.fluffymemory.media;

import dev.fluffymemory.ApiException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Iterator;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.MemoryCacheImageInputStream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class MediaService {
    private static final long MAX_BYTES = 8 * 1024 * 1024;
    private static final int MAX_EDGE = 6000;
    private static final long MAX_PIXELS = 24_000_000;
    private static final String URL_PREFIX = "/api/media/";

    private final JdbcClient database;
    private final Path directory;

    public MediaService(JdbcClient database, @Value("${app.media-directory:./.local/media}") String directory) {
        this.database = database;
        this.directory = Path.of(directory).toAbsolutePath().normalize();
    }

    public record Upload(UUID id, String url) {}

    private record StoredPhoto(UUID id, long ownerId, String contentType, long size, boolean operationsAccess) {}

    public Upload upload(long ownerId, MultipartFile file) throws IOException {
        if (file.isEmpty() || file.getSize() > MAX_BYTES) {
            throw ApiException.badRequest("请选择一张小于 8 MB 的照片");
        }
        String contentType = validateImage(file);
        UUID id = UUID.randomUUID();
        Path destination = directory.resolve(id.toString());
        Files.createDirectories(directory);
        try (InputStream input = file.getInputStream()) {
            Files.copy(input, destination);
            database.sql("""
                INSERT INTO media(id, owner_id, content_type, size_bytes)
                VALUES (:id, :owner, :type, :size)
                """)
                .param("id", id)
                .param("owner", ownerId)
                .param("type", contentType)
                .param("size", file.getSize())
                .update();
        } catch (IOException | RuntimeException failure) {
            try {
                Files.deleteIfExists(destination);
            } catch (IOException cleanupFailure) {
                failure.addSuppressed(cleanupFailure);
            }
            throw failure;
        }
        return new Upload(id, url(id));
    }

    public String requireOwnedPhoto(String photoUrl, long ownerId) {
        UUID id = requireOwnedId(photoUrl, ownerId);
        return url(id);
    }

    public UUID requireOwnedId(String photoUrl, long ownerId) {
        if (photoUrl == null || photoUrl.isBlank()) {
            return null;
        }
        UUID id = parseId(photoUrl);
        readMeta(id)
            .filter(photo -> photo.ownerId() == ownerId)
            .orElseThrow(() -> ApiException.notFound("照片不存在"));
        return id;
    }

    public void allowOperations(String photoUrl, long ownerId) {
        UUID id = requireOwnedId(photoUrl, ownerId);
        if (id != null) {
            database.sql("UPDATE media SET operations_access = true WHERE id = :id AND owner_id = :owner")
                .param("id", id)
                .param("owner", ownerId)
                .update();
        }
    }

    public ResponseEntity<Resource> read(UUID id, long viewerId, boolean isAdmin) {
        StoredPhoto photo = readMeta(id)
            .filter(candidate -> candidate.ownerId() == viewerId || (isAdmin && candidate.operationsAccess()))
            .orElseThrow(() -> ApiException.notFound("照片不存在"));
        return response(photo);
    }

    public ResponseEntity<Resource> readSharedPhoto(UUID id, long memorialOwnerId) {
        StoredPhoto photo = readMeta(id)
            .filter(candidate -> candidate.ownerId() == memorialOwnerId)
            .orElseThrow(() -> ApiException.notFound("照片不存在"));
        return response(photo);
    }

    public static String url(UUID id) {
        return id == null ? null : URL_PREFIX + id;
    }

    private Optional<StoredPhoto> readMeta(UUID id) {
        return database.sql("SELECT id, owner_id, content_type, size_bytes, operations_access FROM media WHERE id = :id")
            .param("id", id)
            .query((row, index) -> new StoredPhoto(row.getObject("id", UUID.class), row.getLong("owner_id"),
                row.getString("content_type"), row.getLong("size_bytes"), row.getBoolean("operations_access")))
            .optional();
    }

    private ResponseEntity<Resource> response(StoredPhoto photo) {
        var resource = new FileSystemResource(directory.resolve(photo.id().toString()));
        if (!resource.isReadable()) {
            throw ApiException.notFound("照片不存在");
        }
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .contentLength(photo.size())
            .contentType(MediaType.parseMediaType(photo.contentType()))
            .header("Cross-Origin-Resource-Policy", "same-origin")
            .body(resource);
    }

    private static UUID parseId(String value) {
        if (!value.startsWith(URL_PREFIX)) {
            throw ApiException.badRequest("请先上传照片");
        }
        try {
            UUID id = UUID.fromString(value.substring(URL_PREFIX.length()));
            if (!url(id).equals(value)) {
                throw ApiException.badRequest("照片地址无效");
            }
            return id;
        } catch (IllegalArgumentException invalid) {
            throw ApiException.badRequest("照片地址无效");
        }
    }

    private static String validateImage(MultipartFile file) throws IOException {
        try (var input = new MemoryCacheImageInputStream(file.getInputStream())) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                throw ApiException.badRequest("请选择 JPG 或 PNG 照片");
            }
            ImageReader reader = readers.next();
            try {
                String mime = switch (reader.getFormatName().toLowerCase(Locale.ROOT)) {
                    case "jpeg" -> "image/jpeg";
                    case "png" -> "image/png";
                    default -> throw ApiException.badRequest("请选择 JPG 或 PNG 照片");
                };
                reader.setInput(input, true, true);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width > MAX_EDGE || height > MAX_EDGE || (long) width * height > MAX_PIXELS) {
                    throw ApiException.badRequest("照片像素过大，请缩小尺寸后重新上传");
                }
                reader.read(0);
                return mime;
            } finally {
                reader.dispose();
            }
        } catch (javax.imageio.IIOException invalid) {
            throw ApiException.badRequest("无法读取照片，请重新上传");
        }
    }
}
