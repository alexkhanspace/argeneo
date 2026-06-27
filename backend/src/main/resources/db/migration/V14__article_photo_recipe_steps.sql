-- ============================================================================
-- Argeneo — GTIN + photo sur l'article, étapes de préparation de recette
-- Données scopées tenant (colonne tenant_id, filtrée par @TenantId).
-- ============================================================================

-- GTIN (code-barres EAN/UPC, 8 à 14 chiffres) + nom du fichier photo uploadé.
ALTER TABLE article ADD COLUMN gtin VARCHAR(14);
ALTER TABLE article ADD COLUMN photo_file VARCHAR(120);

-- Étapes de préparation ordonnées d'une recette.
CREATE TABLE recipe_step (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id   BIGINT  NOT NULL REFERENCES tenant(id),
    recipe_id   BIGINT  NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL,
    instruction TEXT    NOT NULL
);
CREATE INDEX idx_recipe_step_recipe ON recipe_step(recipe_id);
CREATE INDEX idx_recipe_step_tenant ON recipe_step(tenant_id);
