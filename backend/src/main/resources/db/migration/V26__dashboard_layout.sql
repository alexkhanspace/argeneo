-- Tableau de bord personnalisé par principal (utilisateur OU super-admin).
-- Non scopé tenant (préférence par compte) ; layout = JSON (widgets + positions).
CREATE TABLE dashboard_layout (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    principal_id   BIGINT       NOT NULL,
    principal_type VARCHAR(10)  NOT NULL,
    layout         TEXT,
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_dashboard_principal UNIQUE (principal_type, principal_id)
);
