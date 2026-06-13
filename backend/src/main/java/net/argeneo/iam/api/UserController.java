package net.argeneo.iam.api;

import jakarta.validation.Valid;
import java.util.List;
import net.argeneo.iam.api.dto.UserDtos.AssignPermissionsRequest;
import net.argeneo.iam.api.dto.UserDtos.CreateEmployeeRequest;
import net.argeneo.iam.api.dto.UserDtos.UserPermissionsResponse;
import net.argeneo.iam.api.dto.UserDtos.UserResponse;
import net.argeneo.iam.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Parcours Patron : gestion des employés et de leurs permissions. */
@RestController
@RequestMapping("/api/users")
@PreAuthorize("hasRole('PATRON')")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse createEmployee(@Valid @RequestBody CreateEmployeeRequest request) {
        return userService.createEmployee(request);
    }

    @GetMapping
    public List<UserResponse> listEmployees() {
        return userService.listEmployees();
    }

    @GetMapping("/{id}/permissions")
    public UserPermissionsResponse getPermissions(@PathVariable Long id) {
        return userService.getPermissions(id);
    }

    @PutMapping("/{id}/permissions")
    public void assignPermissions(@PathVariable Long id,
                                  @Valid @RequestBody AssignPermissionsRequest request) {
        userService.assignPermissions(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        userService.deleteEmployee(id);
    }
}
