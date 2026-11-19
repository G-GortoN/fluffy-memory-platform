package dev.fluffymemory.account;

import dev.fluffymemory.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.security.Principal;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AccountService accounts;
    private final AuthenticationManager authentication;
    private final HttpSessionSecurityContextRepository contexts;
    private final HttpSessionCsrfTokenRepository csrfTokens;

    public AuthController(AccountService accounts, AuthenticationManager authentication,
                          HttpSessionSecurityContextRepository contexts, HttpSessionCsrfTokenRepository csrfTokens) {
        this.accounts = accounts;
        this.authentication = authentication;
        this.contexts = contexts;
        this.csrfTokens = csrfTokens;
    }

    @GetMapping("/csrf")
    Map<String, String> csrf(CsrfToken token) {
        return Map.of("token", token.getToken());
    }

    @GetMapping("/me")
    AccountService.Account current(Principal principal) {
        return accounts.require(principal.getName());
    }

    @PostMapping("/register")
    AccountService.Account register(@Valid @RequestBody Registration body,
                                    HttpServletRequest request, HttpServletResponse response) {
        AccountService.Account account = accounts.register(body.email(), body.name(), body.password());
        signIn(account.email(), body.password(), request, response);
        return account;
    }

    @PostMapping("/login")
    AccountService.Account login(@Valid @RequestBody Login body,
                                 HttpServletRequest request, HttpServletResponse response) {
        return accounts.require(signIn(body.email(), body.password(), request, response).getName());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void logout(HttpServletRequest request, HttpServletResponse response, Authentication user) {
        var handler = new SecurityContextLogoutHandler();
        handler.setSecurityContextRepository(contexts);
        handler.logout(request, response, user);
    }

    private Authentication signIn(String email, String password, HttpServletRequest request, HttpServletResponse response) {
        AccountService.validatePassword(password, 8);
        Authentication user;
        try {
            user = authentication.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(
                AccountService.normalize(email), password));
        } catch (AuthenticationException failure) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "邮箱或密码有误");
        }
        if (request.getSession(false) != null) {
            request.changeSessionId();
        }
        csrfTokens.saveToken(null, request, response);
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(user);
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
        return user;
    }

    public record Login(@NotBlank @Email @Size(max = 254) String email,
                        @NotBlank @Size(max = 72) String password) {}

    public record Registration(@NotBlank @Email @Size(max = 254) String email,
                               @NotBlank @Size(max = 72) String password,
                               @NotBlank @Size(max = 80) String name) {}
}
