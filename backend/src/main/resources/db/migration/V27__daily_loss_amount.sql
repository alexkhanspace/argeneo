-- Perte du jour en valeur (€), saisie globale simple (complète la casse détaillée par article).
ALTER TABLE daily_entry ADD COLUMN loss_amount NUMERIC(12, 2);
