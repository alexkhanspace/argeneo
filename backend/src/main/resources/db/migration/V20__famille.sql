-- Référentiel des familles / sous-familles, auto-référencé et scopé par périmètre.
-- parent_id NULL = famille de premier niveau ; renseigné = sous-famille.
-- Arborescences séparées entre produits (ARTICLE) et matières premières (RAW_MATERIAL).
CREATE TABLE famille (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id  BIGINT       NOT NULL REFERENCES tenant(id),
    scope      VARCHAR(20)  NOT NULL,
    parent_id  BIGINT       REFERENCES famille(id) ON DELETE CASCADE,
    name       VARCHAR(120) NOT NULL,
    position   INT          NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_famille_scope CHECK (scope IN ('ARTICLE', 'RAW_MATERIAL'))
);
CREATE INDEX idx_famille_tenant ON famille(tenant_id);
CREATE INDEX idx_famille_parent ON famille(parent_id);

-- Classement optionnel des articles et matières (référence vers une famille puis sous-famille).
ALTER TABLE article ADD COLUMN famille_id       BIGINT REFERENCES famille(id);
ALTER TABLE article ADD COLUMN sous_famille_id  BIGINT REFERENCES famille(id);
ALTER TABLE raw_material ADD COLUMN famille_id       BIGINT REFERENCES famille(id);
ALTER TABLE raw_material ADD COLUMN sous_famille_id  BIGINT REFERENCES famille(id);

CREATE INDEX idx_article_famille ON article(famille_id);
CREATE INDEX idx_rawmat_famille ON raw_material(famille_id);
