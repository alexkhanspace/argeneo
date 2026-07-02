-- « Modèle par défaut de l'enseigne » : le modèle appliqué aux produits qui n'ont
-- pas de modèle propre (article.label_template_id NULL) lors de l'impression.
-- Au plus un modèle par défaut par tenant (index unique partiel).
ALTER TABLE label_template ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX uq_label_template_default ON label_template(tenant_id) WHERE is_default;
