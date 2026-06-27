-- ============================================================================
-- Argeneo — Refonte de la saisie quotidienne :
--   * casse / perte désormais PAR ARTICLE (table dédiée)
--   * deux mots du jour distincts : production et vente
-- ============================================================================

-- Deux notes distinctes en remplacement de l'unique note_of_day.
ALTER TABLE daily_entry ADD COLUMN note_prod TEXT;
ALTER TABLE daily_entry ADD COLUMN note_sale TEXT;
UPDATE daily_entry SET note_prod = note_of_day WHERE note_of_day IS NOT NULL;
ALTER TABLE daily_entry DROP COLUMN note_of_day;

-- La perte globale (montant unique) est remplacée par des lignes par article.
ALTER TABLE daily_entry DROP COLUMN loss;

CREATE TABLE daily_entry_loss (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id      BIGINT        NOT NULL,
    daily_entry_id BIGINT        NOT NULL REFERENCES daily_entry (id) ON DELETE CASCADE,
    article_id     BIGINT        NOT NULL REFERENCES article (id),
    -- Quantité perdue, exprimée dans l'unité de l'article.
    quantity       NUMERIC(12, 3) NOT NULL
);

CREATE INDEX idx_daily_entry_loss_entry ON daily_entry_loss (daily_entry_id);
CREATE INDEX idx_daily_entry_loss_article ON daily_entry_loss (article_id);
