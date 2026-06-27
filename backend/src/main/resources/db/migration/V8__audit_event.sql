-- ============================================================================
-- Argeneo — Historique d'usage (audit) consultable par le Super-Admin.
-- Table PLATEFORME (hors tenant) : trace les événements de tous les tenants.
-- ============================================================================

CREATE TABLE audit_event (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    occurred_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    -- Acteur : ADMIN (plateforme) ou USER (métier) ; null si anonyme (login échoué).
    actor_type  VARCHAR(20),
    actor_id    BIGINT,
    actor_email VARCHAR(255),
    -- Tenant concerné (null pour le Super-Admin hors contexte tenant).
    tenant_id   BIGINT,
    -- Verbe métier : LOGIN_SUCCESS, LOGIN_FAILURE, IMPERSONATE_START,
    -- TENANT_CREATE/UPDATE/ARCHIVE, ARTICLE_CREATE/UPDATE/DELETE, USER_*, MATERIAL_*…
    action      VARCHAR(50)  NOT NULL,
    target_type VARCHAR(50),
    target_id   VARCHAR(100),
    summary     VARCHAR(500)
);

CREATE INDEX idx_audit_event_occurred_at ON audit_event (occurred_at DESC);
CREATE INDEX idx_audit_event_tenant ON audit_event (tenant_id);
CREATE INDEX idx_audit_event_actor ON audit_event (actor_email);
