package dev.fluffymemory.account;

import dev.fluffymemory.ApiException;
import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Locale;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AccountService implements UserDetailsService, ApplicationRunner {
    private final JdbcClient database;
    private final PasswordEncoder passwords;
    private final String adminEmail;
    private final String adminPassword;

    public AccountService(JdbcClient database, PasswordEncoder passwords,
                          @Value("${app.admin-email:}") String adminEmail,
                          @Value("${app.admin-password:}") String adminPassword) {
        this.database = database;
        this.passwords = passwords;
        this.adminEmail = adminEmail;
        this.adminPassword = adminPassword;
    }

    public record Account(long id, String email, String name, String role) {}

    public Account require(String email) {
        return database.sql("SELECT id, email, name, role FROM accounts WHERE email = :email")
            .param("email", email)
            .query(AccountService::accountRow)
            .optional()
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "请先登录"));
    }

    public Account register(String email, String name, String password) {
        validatePassword(password, 8);
        return insert(normalize(email), name.strip(), password, "CUSTOMER")
            .orElseThrow(() -> ApiException.conflict("这个邮箱已经注册"));
    }

    @Override
    public UserDetails loadUserByUsername(String email) {
        return database.sql("SELECT email, password_hash, role FROM accounts WHERE email = :email")
            .param("email", normalize(email))
            .query((row, index) -> User.withUsername(row.getString("email"))
                .password(row.getString("password_hash"))
                .roles(row.getString("role"))
                .build())
            .optional()
            .orElseThrow(() -> new UsernameNotFoundException("Account unavailable"));
    }

    @Override
    public void run(ApplicationArguments arguments) {
        if (adminEmail.isBlank() && adminPassword.isBlank()) {
            return;
        }
        String email = normalize(adminEmail);
        if (email.isBlank() || !email.contains("@")) {
            throw new IllegalStateException("APP_ADMIN_EMAIL must contain a valid email address");
        }
        validatePassword(adminPassword, 12);
        Optional<Account> created = insert(email, "运营管理员", adminPassword, "ADMIN");
        if (created.isEmpty() && !"ADMIN".equals(require(email).role())) {
            throw new IllegalStateException("The configured administrator email belongs to a customer account");
        }
    }

    static String normalize(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }

    static void validatePassword(String password, int minimum) {
        if (password.length() < minimum || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw ApiException.badRequest("密码长度至少为 " + minimum + " 个字符，最多为 72 字节");
        }
    }

    private Optional<Account> insert(String email, String name, String password, String role) {
        return database.sql("""
            INSERT INTO accounts(email, name, password_hash, role)
            VALUES (:email, :name, :password, :role)
            ON CONFLICT (email) DO NOTHING
            RETURNING id, email, name, role
            """)
            .param("email", email)
            .param("name", name)
            .param("password", passwords.encode(password))
            .param("role", role)
            .query(AccountService::accountRow)
            .optional();
    }

    private static Account accountRow(ResultSet row, int index) throws SQLException {
        return new Account(row.getLong("id"), row.getString("email"), row.getString("name"), row.getString("role"));
    }
}
