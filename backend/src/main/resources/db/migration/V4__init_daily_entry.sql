-- ============================================================================
-- Argeneo — Saisie quotidienne (calendrier) : CA, perte, mot du jour
-- Par boulangerie et par jour. Historisé dès la V1 (stock de données pour l'IA).
-- ============================================================================

CREATE TABLE daily_entry (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id      BIGINT      NOT NULL REFERENCES tenant(id),
    boulangerie_id BIGINT      NOT NULL REFERENCES boulangerie(id) ON DELETE CASCADE,
    entry_date     DATE        NOT NULL,
    revenue        NUMERIC(12, 2),   -- CA global (saisie manuelle V1)
    loss           NUMERIC(12, 2),   -- perte globale (saisie manuelle V1)
    note_of_day    TEXT,             -- mot du jour (visible équipe, nourrit l'IA)
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_daily UNIQUE (boulangerie_id, entry_date)
);
CREATE INDEX idx_daily_tenant    ON daily_entry(tenant_id);
CREATE INDEX idx_daily_boul_date ON daily_entry(boulangerie_id, entry_date);
