-- ============================================================================
-- Argeneo — Slice 1 : socle Auth + multi-tenant + users/permissions
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Référentiel PLATEFORME (hors tenant)
-- ---------------------------------------------------------------------------

-- Super-Admin : exploitant de la plateforme, au-dessus des tenants.
-- N'est PAS un utilisateur métier -> table séparée.
CREATE TABLE platform_admin (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    full_name     VARCHAR(255) NOT NULL,
    active        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Tenant = l'artisan / l'enseigne (1..N boulangeries). Racine de l'isolation.
CREATE TABLE tenant (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    -- Réglage tenant : recettes communes à l'enseigne OU propres à chaque boulangerie.
    recipe_scope VARCHAR(20)  NOT NULL DEFAULT 'ENSEIGNE',
    active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_tenant_recipe_scope CHECK (recipe_scope IN ('ENSEIGNE', 'BOULANGERIE'))
);

-- ---------------------------------------------------------------------------
-- Catalogue des permissions atomiques (référence globale, partagée plateforme)
-- ---------------------------------------------------------------------------
CREATE TABLE permission (
    code     VARCHAR(50)  PRIMARY KEY,
    label    VARCHAR(150) NOT NULL,
    category VARCHAR(50)  NOT NULL
);

-- Presets UI = paquets de permissions pré-cochés (commodité d'interface).
-- La vérité reste la liste granulaire des grants ; ceci n'est qu'un raccourci.
CREATE TABLE permission_preset (
    code  VARCHAR(50)  PRIMARY KEY,
    label VARCHAR(150) NOT NULL
);

CREATE TABLE permission_preset_item (
    preset_code     VARCHAR(50) NOT NULL REFERENCES permission_preset(code) ON DELETE CASCADE,
    permission_code VARCHAR(50) NOT NULL REFERENCES permission(code)        ON DELETE CASCADE,
    PRIMARY KEY (preset_code, permission_code)
);

-- ---------------------------------------------------------------------------
-- Données métier (SCOPÉES tenant — colonne tenant_id, filtrée par Hibernate @TenantId)
-- ---------------------------------------------------------------------------

CREATE TABLE boulangerie (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id  BIGINT       NOT NULL REFERENCES tenant(id),
    name       VARCHAR(255) NOT NULL,
    address    VARCHAR(500),
    active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_boulangerie_tenant ON boulangerie(tenant_id);

-- Utilisateur métier : Patron ou Employé. E-mail unique au global (login sans tenant).
CREATE TABLE app_user (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id     BIGINT       NOT NULL REFERENCES tenant(id),
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    full_name     VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL,
    active        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_app_user_email UNIQUE (email),
    CONSTRAINT chk_app_user_role CHECK (role IN ('PATRON', 'EMPLOYE'))
);
CREATE INDEX idx_app_user_tenant ON app_user(tenant_id);

-- Attribution contextualisée : l'unité est (user, boulangerie, permission).
-- Un même employé peut être manager à Lyon et vendeur à Villeurbanne.
CREATE TABLE permission_grant (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id       BIGINT      NOT NULL REFERENCES tenant(id),
    user_id         BIGINT      NOT NULL REFERENCES app_user(id)    ON DELETE CASCADE,
    boulangerie_id  BIGINT      NOT NULL REFERENCES boulangerie(id) ON DELETE CASCADE,
    permission_code VARCHAR(50) NOT NULL REFERENCES permission(code),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_grant UNIQUE (user_id, boulangerie_id, permission_code)
);
CREATE INDEX idx_grant_tenant ON permission_grant(tenant_id);
CREATE INDEX idx_grant_user   ON permission_grant(user_id);
