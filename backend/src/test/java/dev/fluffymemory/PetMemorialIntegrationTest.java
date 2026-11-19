package dev.fluffymemory;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "server.address=127.0.0.1", "server.servlet.session.cookie.secure=false"
})
class PetMemorialIntegrationTest {
    private static final String ADMIN_EMAIL = "operator-" + UUID.randomUUID() + "@example.test";
    private static final String ADMIN_PASSWORD = UUID.randomUUID().toString();
    private static final String CUSTOMER_PASSWORD = UUID.randomUUID().toString();
    private static final JsonMapper JSON = JsonMapper.builder().build();

    @LocalServerPort
    int port;

    @DynamicPropertySource
    static void setup(DynamicPropertyRegistry registry) {
        String external = System.getenv("FLUFFY_TEST_DATABASE_URL");
        if (external == null || external.isBlank()) {
            var postgres = new PostgreSQLContainer("postgres:17-alpine");
            postgres.start();
            registry.add("spring.datasource.url", postgres::getJdbcUrl);
            registry.add("spring.datasource.username", postgres::getUsername);
            registry.add("spring.datasource.password", postgres::getPassword);
        } else {
            registry.add("spring.datasource.url", () -> external);
            registry.add("spring.datasource.username", () -> System.getenv().getOrDefault("DATABASE_USERNAME", "fluffy_memory"));
            registry.add("spring.datasource.password", () -> System.getenv().getOrDefault("DATABASE_PASSWORD", ""));
        }
        registry.add("app.admin-email", () -> ADMIN_EMAIL);
        registry.add("app.admin-password", () -> ADMIN_PASSWORD);
        String mediaDirectory = "target/test-media/" + UUID.randomUUID();
        registry.add("app.media-directory", () -> mediaDirectory);
    }

    @Test
    void sessionEnforcesCsrfAndAdminRole() throws Exception {
        Browser customer = new Browser();
        customer.expectStatus(401, customer.get("/api/auth/me"));
        String email = UUID.randomUUID() + "@example.test";
        var registration = Map.of("email", email, "name", "照护测试", "password", CUSTOMER_PASSWORD);
        customer.expectStatus(403, customer.send("POST", "/api/auth/register", registration, null));
        String anonymousCsrf = customer.csrf();
        customer.expectStatus(200, customer.send("POST", "/api/auth/register", registration, anonymousCsrf));
        assertEquals(email, customer.json(200, customer.get("/api/auth/me")).get("email").asString());
        customer.expectStatus(403, customer.get("/api/admin/care"));
        customer.expectStatus(403, customer.send("POST", "/api/auth/logout", null, anonymousCsrf));
        customer.expectStatus(204, customer.change("POST", "/api/auth/logout", null));
        customer.expectStatus(401, customer.get("/api/auth/me"));
        assertEquals("CUSTOMER", customer.json(200, customer.change("POST", "/api/auth/login",
            Map.of("email", email, "password", CUSTOMER_PASSWORD))).get("role").asString());
    }

    @Test
    void linkingMemorialChangesOnlyItsPetAndRevokesSharedImages() throws Exception {
        Browser owner = registeredBrowser();
        Browser guest = new Browser();
        Browser otherOwner = registeredBrowser();
        String photo = owner.json(200, owner.uploadPng()).get("url").asString();
        long firstPet = owner.json(200, owner.change("POST", "/api/pets", Map.of(
            "name", "奶糖", "species", "CAT", "ageMonths", 36, "photoUrl", photo))).get("id").asLong();
        long secondPet = owner.json(200, owner.change("POST", "/api/pets", Map.of(
            "name", "米团", "species", "DOG", "ageMonths", 8))).get("id").asLong();
        String petPath = "/api/pets/" + firstPet;
        assertFalse(owner.json(200, owner.get(petPath + "/care")).isEmpty());
        otherOwner.expectStatus(404, otherOwner.get(petPath));
        otherOwner.expectStatus(404, otherOwner.get(photo));
        var memorial = owner.json(200, owner.change("POST", "/api/memorials", Map.of(
            "petId", firstPet, "title", "想念奶糖", "template", "CORNER", "story", "我们一起等日落。",
            "gallery", List.of(photo), "timeline", List.of(Map.of("date", "2020-01-10", "text", "第一次见面")))));
        String memorialPath = "/api/memorials/" + memorial.get("id").asLong();
        assertFalse(memorial.get("shareEnabled").asBoolean());
        otherOwner.expectStatus(404, otherOwner.get(memorialPath));
        assertEquals("DECEASED", owner.json(200, owner.get(petPath)).get("status").asString());
        assertTrue(owner.json(200, owner.get(petPath + "/care")).isEmpty());
        assertEquals("ACTIVE", owner.json(200, owner.get("/api/pets/" + secondPet)).get("status").asString());
        assertFalse(owner.json(200, owner.get("/api/pets/" + secondPet + "/care")).isEmpty());
        String sharedOne = "/api/shared/" + owner.json(200, owner.change("POST", memorialPath + "/share", null))
            .get("token").asString();
        var sharedResponse = guest.get(sharedOne);
        assertTrue(sharedResponse.headers().firstValue("Cache-Control").orElseThrow().contains("no-store"));
        var shared = guest.json(200, sharedResponse);
        assertEquals("第一次见面", shared.get("timeline").get(0).get("text").asString());
        String cover = shared.get("photoUrl").asString();
        String gallery = shared.get("gallery").get(0).asString();
        guest.expectStatus(200, guest.get(cover));
        guest.expectStatus(200, guest.get(gallery));
        guest.expectStatus(401, guest.get(photo));
        String sharedTwo = "/api/shared/" + owner.json(200, owner.change("POST", memorialPath + "/share", null))
            .get("token").asString();
        guest.expectStatus(404, guest.get(sharedOne));
        guest.expectStatus(404, guest.get(cover));
        guest.expectStatus(404, guest.get(gallery));
        guest.expectStatus(200, guest.get(sharedTwo + "/photo"));
        owner.expectStatus(204, owner.change("DELETE", memorialPath + "/share", null));
        guest.expectStatus(404, guest.get(sharedTwo));
        guest.expectStatus(404, guest.get(sharedTwo + "/photo"));
    }

    @Test
    void onlyPublishedCareContentMatchesBreedAndStage() throws Exception {
        Browser admin = new Browser();
        admin.expectStatus(200, admin.change("POST", "/api/auth/login",
            Map.of("email", ADMIN_EMAIL, "password", ADMIN_PASSWORD)));
        Browser owner = registeredBrowser();
        String label = "照护测试-" + UUID.randomUUID();
        var card = new java.util.HashMap<String, Object>(Map.of("title", label, "summary", "记录体重",
            "body", "整理日常变化，供咨询兽医时参考。", "sourceUrl", "https://www.aaha.org/",
            "species", "DOG", "stage", "YOUNG", "breed", "测试犬种", "published", false));
        long careId = admin.json(200, admin.change("POST", "/api/admin/care", card)).get("id").asLong();
        long petId = owner.json(200, owner.change("POST", "/api/pets",
            Map.of("name", "小满", "species", "DOG", "ageMonths", 3, "breed", "测试犬种"))).get("id").asLong();
        String carePath = "/api/pets/" + petId + "/care";
        assertFalse(owner.json(200, owner.get(carePath)).toString().contains(label));
        card.put("published", true);
        admin.expectStatus(200, admin.change("PUT", "/api/admin/care/" + careId, card));
        assertTrue(owner.json(200, owner.get(carePath)).toString().contains(label));
        owner.expectStatus(200, owner.change("PUT", "/api/pets/" + petId,
            Map.of("name", "小满", "species", "DOG", "ageMonths", 24, "breed", "测试犬种")));
        assertFalse(owner.json(200, owner.get(carePath)).toString().contains(label));
        assertTrue(admin.json(200, admin.get("/api/admin/audit")).toString().contains("CARE_CARD"));
    }

    private Browser registeredBrowser() throws Exception {
        Browser browser = new Browser();
        browser.expectStatus(200, browser.change("POST", "/api/auth/register", Map.of(
            "email", UUID.randomUUID() + "@example.test", "name", "测试用户", "password", CUSTOMER_PASSWORD)));
        return browser;
    }

    private final class Browser {
        private final HttpClient client = HttpClient.newBuilder()
            .cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL)).build();

        HttpResponse<byte[]> get(String path) throws Exception {
            return send("GET", path, null, null);
        }

        HttpResponse<byte[]> change(String method, String path, Object body) throws Exception {
            return send(method, path, body, csrf());
        }

        String csrf() throws Exception {
            return json(200, get("/api/auth/csrf")).get("token").asString();
        }

        HttpResponse<byte[]> uploadPng() throws Exception {
            String boundary = "test-file-" + UUID.randomUUID();
            var content = new ByteArrayOutputStream();
            content.writeBytes(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"photo.png\"\r\n"
                + "Content-Type: image/png\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            ImageIO.write(new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB), "png", content);
            content.writeBytes(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
            return client.send(request("/api/media").header("X-CSRF-TOKEN", csrf())
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(content.toByteArray())).build(), HttpResponse.BodyHandlers.ofByteArray());
        }

        HttpResponse<byte[]> send(String method, String path, Object body, String csrf) throws Exception {
            var request = request(path);
            if (csrf != null) {
                request.header("X-CSRF-TOKEN", csrf);
            }
            var publisher = HttpRequest.BodyPublishers.noBody();
            if (body != null) {
                request.header("Content-Type", "application/json");
                publisher = HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body));
            }
            return client.send(request.method(method, publisher).build(), HttpResponse.BodyHandlers.ofByteArray());
        }

        void expectStatus(int expected, HttpResponse<byte[]> result) {
            assertEquals(expected, result.statusCode(), () -> result.uri() + " → "
                + new String(result.body(), StandardCharsets.UTF_8));
        }

        JsonNode json(int expected, HttpResponse<byte[]> result) throws IOException {
            expectStatus(expected, result);
            return JSON.readTree(result.body());
        }

        private HttpRequest.Builder request(String path) {
            return HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path));
        }
    }
}
