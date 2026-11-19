package dev.fluffymemory.media;

import dev.fluffymemory.account.AccountService;
import java.io.IOException;
import java.security.Principal;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/media")
public class MediaController {
    private final AccountService accounts;
    private final MediaService media;

    public MediaController(AccountService accounts, MediaService media) {
        this.accounts = accounts;
        this.media = media;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    MediaService.Upload upload(@RequestParam("file") MultipartFile file, Principal user) throws IOException {
        return media.upload(accounts.require(user.getName()).id(), file);
    }

    @GetMapping("/{id}")
    ResponseEntity<Resource> photo(@PathVariable UUID id, Principal user) {
        var account = accounts.require(user.getName());
        return media.read(id, account.id(), "ADMIN".equals(account.role()));
    }
}
