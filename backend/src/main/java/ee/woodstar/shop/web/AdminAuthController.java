package ee.woodstar.shop.web;

import ee.woodstar.shop.web.Dtos.LoginRequest;
import ee.woodstar.shop.web.Dtos.MeResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminAuthController {

    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository securityContextRepository;

    @PostMapping("/login")
    public MeResponse login(@Valid @RequestBody LoginRequest req, HttpServletRequest request, HttpServletResponse response) {
        Authentication auth;
        try {
            auth = authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(req.username(), req.password()));
        } catch (AuthenticationException e) {
            throw new ApiException(org.springframework.http.HttpStatus.UNAUTHORIZED, "BAD_CREDENTIALS", "Wrong username or password");
        }
        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(auth);
        SecurityContextHolder.setContext(ctx);
        securityContextRepository.saveContext(ctx, request, response);
        return new MeResponse(auth.getName());
    }

    @PostMapping("/logout")
    public Map<String, String> logout(HttpServletRequest request) {
        SecurityContextHolder.clearContext();
        if (request.getSession(false) != null) request.getSession(false).invalidate();
        return Map.of("status", "ok");
    }

    @GetMapping("/me")
    public MeResponse me(Authentication auth) {
        return new MeResponse(auth.getName());
    }
}
