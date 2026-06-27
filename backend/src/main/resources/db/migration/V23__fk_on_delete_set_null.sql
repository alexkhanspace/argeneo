-- Liens d'HISTORIQUE (pas de vraie dépendance) : à la suppression d'une matière première ou
-- d'un article, on délie au lieu de bloquer. La facture / la communication garde sa trace,
-- seule la référence passe à NULL. (Les vraies dépendances — recettes — restent vérifiées
-- côté service avec un message clair.)
ALTER TABLE supplier_invoice_line DROP CONSTRAINT supplier_invoice_line_raw_material_id_fkey;
ALTER TABLE supplier_invoice_line ADD CONSTRAINT supplier_invoice_line_raw_material_id_fkey
    FOREIGN KEY (raw_material_id) REFERENCES raw_material(id) ON DELETE SET NULL;

ALTER TABLE communication DROP CONSTRAINT communication_article_id_fkey;
ALTER TABLE communication ADD CONSTRAINT communication_article_id_fkey
    FOREIGN KEY (article_id) REFERENCES article(id) ON DELETE SET NULL;
