-- ============================================================================
-- Convention de prix : tout en HT sauf le prix de vente (TTC, prix client).
-- On explicite la sémantique de la colonne au niveau du schéma.
-- ============================================================================

ALTER TABLE article RENAME COLUMN sale_price TO sale_price_ttc;
