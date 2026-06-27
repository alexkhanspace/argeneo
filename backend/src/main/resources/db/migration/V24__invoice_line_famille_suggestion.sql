-- Classement automatique proposé par l'IA au scan : famille/sous-famille créées et rattachées
-- à chaque ligne. Références souples (pas de FK) car ce ne sont que des suggestions.
ALTER TABLE supplier_invoice_line ADD COLUMN suggested_famille_id      BIGINT;
ALTER TABLE supplier_invoice_line ADD COLUMN suggested_sous_famille_id BIGINT;
