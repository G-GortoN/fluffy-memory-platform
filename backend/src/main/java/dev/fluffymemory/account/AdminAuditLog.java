package dev.fluffymemory.account;

import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AdminAuditLog {
    private final JdbcClient database;

    public AdminAuditLog(JdbcClient database) {
        this.database = database;
    }

    public void record(long operatorId, String action, String subjectType, long subjectId) {
        database.sql("""
            INSERT INTO admin_actions (operator_id, action, subject_type, subject_id)
            VALUES (:operator, :action, :type, :subject)
            """)
            .param("operator", operatorId)
            .param("action", action)
            .param("type", subjectType)
            .param("subject", subjectId)
            .update();
    }

    @GetMapping("/api/admin/audit")
    List<Action> recent() {
        return database.sql("""
            SELECT event.id, account.name, event.action, event.subject_type, event.subject_id, event.created_at
            FROM admin_actions event JOIN accounts account ON account.id = event.operator_id
            ORDER BY event.id DESC LIMIT 100
            """)
            .query((row, index) -> new Action(row.getLong("id"), row.getString("name"), row.getString("action"),
                row.getString("subject_type"), row.getLong("subject_id"), row.getObject("created_at", OffsetDateTime.class)))
            .list();
    }

    public record Action(long id, String operatorName, String action, String subjectType, long subjectId,
                         OffsetDateTime createdAt) {}
}
