-- ============================================================================
-- Argeneo — fréquentation : nombre de clients du jour. Le « ticket moyen »
-- (CA / nb clients) est calculé à la volée, pas stocké.
-- ============================================================================

ALTER TABLE daily_entry ADD COLUMN client_count INTEGER;
