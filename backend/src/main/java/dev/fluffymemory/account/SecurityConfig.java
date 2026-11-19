package dev.fluffymemory.account;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;

@Configuration
public class SecurityConfig {
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    AuthenticationManager authenticationManager(AccountService accounts, PasswordEncoder passwords) {
        var provider = new DaoAuthenticationProvider(accounts);
        provider.setPasswordEncoder(passwords);
        return new ProviderManager(provider);
    }

    @Bean
    HttpSessionCsrfTokenRepository csrfTokens() {
        return new HttpSessionCsrfTokenRepository();
    }

    @Bean
    HttpSessionSecurityContextRepository securityContexts() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    SecurityFilterChain filterChain(HttpSecurity security, AuthenticationManager authentication,
                                    HttpSessionCsrfTokenRepository csrfTokens,
                                    HttpSessionSecurityContextRepository contexts) throws Exception {
        return security
            .authenticationManager(authentication)
            .securityContext(context -> context.securityContextRepository(contexts).requireExplicitSave(true))
            .csrf(csrf -> csrf.csrfTokenRepository(csrfTokens))
            .requestCache(AbstractHttpConfigurer::disable)
            .logout(AbstractHttpConfigurer::disable)
            .headers(headers -> headers.referrerPolicy(referrer -> referrer.policy(
                org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER)))
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint((request, response, error) -> reject(response, 401, "请先登录"))
                .accessDeniedHandler((request, response, error) -> reject(response, 403, "你没有权限执行此操作，或会话已过期")))
            .authorizeHttpRequests(routes -> routes
                .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                .requestMatchers(HttpMethod.GET, "/actuator/health", "/api/auth/csrf", "/api/products",
                    "/api/products/*", "/api/shared/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/login", "/api/auth/register").permitAll()
                .requestMatchers("/api/admin/**", "/api/openapi", "/api/openapi/**", "/api/docs",
                    "/api/docs/**", "/swagger-ui/**").hasRole("ADMIN")
                .requestMatchers("/api/**").authenticated()
                .anyRequest().denyAll())
            .build();
    }

    private static void reject(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"message\":\"" + message + "\"}");
    }
}
