-- ============================================================================
-- Renommage métier : "boulangerie" -> "etablissement" (généralise à
-- boucherie / traiteur). Renomme table, colonnes, index et la valeur recipe_scope.
-- ============================================================================

-- 1) Valeur du réglage recipe_scope : retirer la contrainte AVANT de migrer les données.
ALTER TABLE tenant DROP CONSTRAINT chk_tenant_recipe_scope;
UPDATE tenant SET recipe_scope = 'ETABLISSEMENT' WHERE recipe_scope = 'BOULANGERIE';
ALTER TABLE tenant ADD CONSTRAINT chk_tenant_recipe_scope
    CHECK (recipe_scope IN ('ENSEIGNE', 'ETABLISSEMENT'));

-- 2) Table principale + son index (les FK suivent automatiquement)
ALTER TABLE boulangerie RENAME TO etablissement;
ALTER INDEX idx_boulangerie_tenant RENAME TO idx_etablissement_tenant;

-- 3) Colonnes de rattachement
ALTER TABLE permission_grant RENAME COLUMN boulangerie_id TO etablissement_id;
ALTER TABLE daily_entry RENAME COLUMN boulangerie_id TO etablissement_id;
ALTER INDEX idx_daily_boul_date RENAME TO idx_daily_etab_date;
