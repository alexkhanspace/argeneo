-- Livraison par cadencier : la plupart des fournisseurs livrent à jour fixe (ex. mardi),
-- d'autres (farine) acceptent une date demandée à la commande.
ALTER TABLE order_sheet ADD COLUMN delivery_date_choice BOOLEAN NOT NULL DEFAULT FALSE;
-- Jours habituels de livraison, ISO (1 = lundi … 7 = dimanche), séparés par des virgules.
ALTER TABLE order_sheet ADD COLUMN delivery_days VARCHAR(20);

-- Réception des commandes : statut « RECUE » + date de pointage.
ALTER TABLE purchase_order DROP CONSTRAINT chk_purchase_order_status;
ALTER TABLE purchase_order ADD CONSTRAINT chk_purchase_order_status
    CHECK (status IN ('BROUILLON', 'VALIDEE', 'RECUE'));
ALTER TABLE purchase_order ADD COLUMN received_at TIMESTAMPTZ;
