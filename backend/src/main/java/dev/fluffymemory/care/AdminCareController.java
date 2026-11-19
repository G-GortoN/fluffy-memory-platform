package dev.fluffymemory.care;

import dev.fluffymemory.account.AccountService;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/care")
public class AdminCareController {
    private final AccountService accounts;
    private final CareService care;

    public AdminCareController(AccountService accounts, CareService care) {
        this.accounts = accounts;
        this.care = care;
    }

    @GetMapping
    List<CareService.Card> list() {
        return care.list();
    }

    @PostMapping
    CareService.Card create(@Valid @RequestBody CareService.Edit edit, Principal operator) {
        return care.create(edit, accounts.require(operator.getName()).id());
    }

    @PutMapping("/{id}")
    CareService.Card update(@PathVariable long id, @Valid @RequestBody CareService.Edit edit, Principal operator) {
        return care.update(id, edit, accounts.require(operator.getName()).id());
    }
}
