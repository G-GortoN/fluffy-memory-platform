package dev.fluffymemory.memorial;

import dev.fluffymemory.account.AccountService;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import java.util.Map;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MemorialController {
    private final AccountService accounts;
    private final MemorialService memorials;

    public MemorialController(AccountService accounts, MemorialService memorials) {
        this.accounts = accounts;
        this.memorials = memorials;
    }

    @GetMapping("/api/memorials")
    List<MemorialService.Memorial> list(Principal user) {
        return memorials.list(owner(user));
    }

    @GetMapping("/api/memorials/{id}")
    MemorialService.Memorial get(@PathVariable long id, Principal user) {
        return memorials.get(owner(user), id);
    }

    @PostMapping("/api/memorials")
    MemorialService.Memorial create(@Valid @RequestBody MemorialService.Edit edit, Principal user) {
        return memorials.create(owner(user), edit);
    }

    @PutMapping("/api/memorials/{id}")
    MemorialService.Memorial update(@PathVariable long id, @Valid @RequestBody MemorialService.Edit edit, Principal user) {
        return memorials.update(owner(user), id, edit);
    }

    @DeleteMapping("/api/memorials/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable long id, Principal user) {
        memorials.delete(owner(user), id);
    }

    @PostMapping("/api/memorials/{id}/share")
    Map<String, String> share(@PathVariable long id, Principal user) {
        return Map.of("token", memorials.share(owner(user), id));
    }

    @DeleteMapping("/api/memorials/{id}/share")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void revoke(@PathVariable long id, Principal user) {
        memorials.revoke(owner(user), id);
    }

    @GetMapping("/api/shared/{token}")
    ResponseEntity<MemorialService.Memorial> shared(@PathVariable String token) {
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .header("X-Robots-Tag", "noindex, nofollow")
            .body(memorials.getShared(token));
    }

    @GetMapping("/api/shared/{token}/photo")
    ResponseEntity<Resource> sharedCover(@PathVariable String token) {
        return memorials.getSharedCover(token);
    }

    @GetMapping("/api/shared/{token}/gallery/{position}")
    ResponseEntity<Resource> sharedGallery(@PathVariable String token, @PathVariable int position) {
        return memorials.getSharedGalleryPhoto(token, position);
    }

    private long owner(Principal user) {
        return accounts.require(user.getName()).id();
    }
}
