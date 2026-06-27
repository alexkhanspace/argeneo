-- Source d'approvisionnement (fournisseur) d'une matière première : METRO, CGA, etc.
-- Auto-renseignée au scan d'une facture, affichée dans la fiche coût.
ALTER TABLE raw_material ADD COLUMN supplier VARCHAR(120);
