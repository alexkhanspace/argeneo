-- ============================================================================
-- Argeneo — Articles, matières premières, recettes & moteur de coût (PNET)
-- Données scopées tenant (colonne tenant_id, filtrée par @TenantId).
-- ============================================================================

-- Matière première : ingrédient acheté, prix net courant par unité de référence.
CREATE TABLE raw_material (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id      BIGINT        NOT NULL REFERENCES tenant(id),
    name           VARCHAR(255)  NOT NULL,
    reference_unit VARCHAR(10)   NOT NULL,
    price_per_unit NUMERIC(12, 4) NOT NULL DEFAULT 0,
    active         BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT chk_rawmat_unit CHECK (reference_unit IN ('G', 'KG', 'ML', 'L', 'PIECE'))
);
CREATE INDEX idx_rawmat_tenant ON raw_material(tenant_id);

-- Article vendable : acheté-revendu (PNET = prix d'achat) ou fabriqué (PNET calculé).
CREATE TABLE article (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id      BIGINT        NOT NULL REFERENCES tenant(id),
    name           VARCHAR(255)  NOT NULL,
    type           VARCHAR(20)   NOT NULL,
    unit           VARCHAR(10)   NOT NULL,
    sale_price     NUMERIC(12, 4),
    vat_rate       NUMERIC(5, 4),
    purchase_price NUMERIC(12, 4),
    active         BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT chk_article_type CHECK (type IN ('ACHAT_REVENTE', 'FABRIQUE')),
    CONSTRAINT chk_article_unit CHECK (unit IN ('G', 'KG', 'ML', 'L', 'PIECE'))
);
CREATE INDEX idx_article_tenant ON article(tenant_id);

-- Recette d'un article fabriqué : rendement + taux de perte + méthode.
CREATE TABLE recipe (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id        BIGINT        NOT NULL REFERENCES tenant(id),
    article_id       BIGINT        NOT NULL REFERENCES article(id) ON DELETE CASCADE,
    yield_quantity   NUMERIC(12, 4) NOT NULL,
    yield_unit       VARCHAR(10)   NOT NULL,
    loss_rate        NUMERIC(5, 4) NOT NULL DEFAULT 0,
    method           TEXT,
    duration_minutes INTEGER,
    CONSTRAINT uq_recipe_article UNIQUE (article_id),
    CONSTRAINT chk_recipe_unit CHECK (yield_unit IN ('G', 'KG', 'ML', 'L', 'PIECE')),
    CONSTRAINT chk_recipe_loss CHECK (loss_rate >= 0 AND loss_rate < 1)
);
CREATE INDEX idx_recipe_tenant ON recipe(tenant_id);

-- Composant de recette : une quantité d'une matière première OU d'une sous-recette.
CREATE TABLE recipe_component (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id       BIGINT        NOT NULL REFERENCES tenant(id),
    recipe_id       BIGINT        NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,
    type            VARCHAR(20)   NOT NULL,
    raw_material_id BIGINT        REFERENCES raw_material(id),
    sub_article_id  BIGINT        REFERENCES article(id),
    quantity        NUMERIC(12, 4) NOT NULL,
    unit            VARCHAR(10)   NOT NULL,
    CONSTRAINT chk_comp_type CHECK (type IN ('RAW', 'SUBRECIPE')),
    CONSTRAINT chk_comp_unit CHECK (unit IN ('G', 'KG', 'ML', 'L', 'PIECE')),
    CONSTRAINT chk_comp_ref CHECK (
        (type = 'RAW'       AND raw_material_id IS NOT NULL AND sub_article_id IS NULL) OR
        (type = 'SUBRECIPE' AND sub_article_id  IS NOT NULL AND raw_material_id IS NULL)
    )
);
CREATE INDEX idx_comp_tenant ON recipe_component(tenant_id);
CREATE INDEX idx_comp_recipe ON recipe_component(recipe_id);
