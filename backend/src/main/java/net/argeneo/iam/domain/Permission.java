package net.argeneo.iam.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Permission atomique (référence globale). Le code est la clé (ex. {@code saisir_ca}). */
@Entity
@Table(name = "permission")
@Getter
@Setter
@NoArgsConstructor
public class Permission {

    @Id
    @Column(length = 50)
    private String code;

    @Column(nullable = false, length = 150)
    private String label;

    @Column(nullable = false, length = 50)
    private String category;
}
