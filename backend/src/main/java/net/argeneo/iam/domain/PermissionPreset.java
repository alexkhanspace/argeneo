package net.argeneo.iam.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.util.LinkedHashSet;
import java.util.Set;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Preset UI : paquet de permissions pré-cochées (commodité d'interface). */
@Entity
@Table(name = "permission_preset")
@Getter
@Setter
@NoArgsConstructor
public class PermissionPreset {

    @Id
    @Column(length = 50)
    private String code;

    @Column(nullable = false, length = 150)
    private String label;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "permission_preset_item",
            joinColumns = @JoinColumn(name = "preset_code"))
    @Column(name = "permission_code")
    private Set<String> permissionCodes = new LinkedHashSet<>();
}
