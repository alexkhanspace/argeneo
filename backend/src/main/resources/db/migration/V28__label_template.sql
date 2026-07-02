-- Modèles d'étiquette réutilisables (mise en forme + badges), scopés tenant.
-- Un modèle porte le style (couleurs, taille, cadre, craie…) ET ses badges
-- (Kasher, Vegan…) : ex. « Ardoise Kasher » = style ardoise + badge Kasher.
-- Les badges sont stockés en JSON (liste de { text, color } ou { img }).
CREATE TABLE label_template (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id       BIGINT           NOT NULL REFERENCES tenant(id),
    name            VARCHAR(120)     NOT NULL,
    brand           VARCHAR(120),
    bg_color        VARCHAR(20)      NOT NULL DEFAULT '#ffffff',
    text_color      VARCHAR(20)      NOT NULL DEFAULT '#111111',
    border_color    VARCHAR(20)      NOT NULL DEFAULT '#111111',
    width_cm        DOUBLE PRECISION NOT NULL DEFAULT 10,
    height_cm       DOUBLE PRECISION NOT NULL DEFAULT 6,
    font_scale      DOUBLE PRECISION NOT NULL DEFAULT 1,
    show_price      BOOLEAN          NOT NULL DEFAULT TRUE,
    frame           VARCHAR(10)      NOT NULL DEFAULT 'none',
    chalk           BOOLEAN          NOT NULL DEFAULT FALSE,
    fill_sheet      BOOLEAN          NOT NULL DEFAULT FALSE,
    badge_pos       VARCHAR(10)      NOT NULL DEFAULT 'tr',
    badge_scale     DOUBLE PRECISION NOT NULL DEFAULT 1,
    extra_text      TEXT,
    use_description BOOLEAN          NOT NULL DEFAULT FALSE,
    badges          TEXT,
    created_at      TIMESTAMPTZ      NOT NULL DEFAULT now()
);
CREATE INDEX idx_label_template_tenant ON label_template(tenant_id);

-- Modèle d'étiquette affecté à un article (optionnel). À la suppression du
-- modèle, l'article est simplement détaché (SET NULL), il n'est pas supprimé.
ALTER TABLE article ADD COLUMN label_template_id BIGINT REFERENCES label_template(id) ON DELETE SET NULL;
CREATE INDEX idx_article_label_template ON article(label_template_id);
