-- Commandes fournisseurs : cadenciers (modèles de bon de commande par fournisseur) et
-- commandes passées à partir d'un cadencier, par établissement.

CREATE TABLE order_sheet (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id       BIGINT        NOT NULL REFERENCES tenant(id),
    name            VARCHAR(150)  NOT NULL,
    supplier_name   VARCHAR(255),
    supplier_email  VARCHAR(255),
    supplier_phone  VARCHAR(50),
    notes           TEXT,
    color           VARCHAR(9),
    show_prices     BOOLEAN       NOT NULL DEFAULT TRUE,
    active          BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_sheet_tenant ON order_sheet(tenant_id);

CREATE TABLE order_sheet_line (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id        BIGINT        NOT NULL REFERENCES tenant(id),
    sheet_id         BIGINT        NOT NULL REFERENCES order_sheet(id) ON DELETE CASCADE,
    position         INT           NOT NULL DEFAULT 0,
    section          VARCHAR(120),
    code             VARCHAR(60),
    designation      VARCHAR(300)  NOT NULL,
    designation_alt  VARCHAR(300),
    packaging        VARCHAR(120),
    unit_price       NUMERIC(12, 4),
    price_unit       VARCHAR(30),
    raw_material_id  BIGINT        REFERENCES raw_material(id) ON DELETE SET NULL
);
CREATE INDEX idx_order_sheet_line_sheet ON order_sheet_line(sheet_id);

CREATE TABLE purchase_order (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id         BIGINT        NOT NULL REFERENCES tenant(id),
    sheet_id          BIGINT        REFERENCES order_sheet(id) ON DELETE SET NULL,
    sheet_name        VARCHAR(150)  NOT NULL,
    supplier_name     VARCHAR(255),
    etablissement_id  BIGINT        REFERENCES etablissement(id) ON DELETE SET NULL,
    order_date        DATE          NOT NULL,
    delivery_date     DATE,
    status            VARCHAR(20)   NOT NULL DEFAULT 'BROUILLON',
    notes             TEXT,
    created_by_id     BIGINT,
    created_by_name   VARCHAR(255),
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    validated_at      TIMESTAMPTZ,
    CONSTRAINT chk_purchase_order_status CHECK (status IN ('BROUILLON', 'VALIDEE'))
);
CREATE INDEX idx_purchase_order_tenant ON purchase_order(tenant_id, order_date DESC);

CREATE TABLE purchase_order_line (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id       BIGINT        NOT NULL REFERENCES tenant(id),
    order_id        BIGINT        NOT NULL REFERENCES purchase_order(id) ON DELETE CASCADE,
    sheet_line_id   BIGINT        REFERENCES order_sheet_line(id) ON DELETE SET NULL,
    position        INT           NOT NULL DEFAULT 0,
    section         VARCHAR(120),
    code            VARCHAR(60),
    designation     VARCHAR(300)  NOT NULL,
    packaging       VARCHAR(120),
    unit_price      NUMERIC(12, 4),
    price_unit      VARCHAR(30),
    quantity        NUMERIC(12, 3) NOT NULL
);
CREATE INDEX idx_purchase_order_line_order ON purchase_order_line(order_id);

-- Permission employé : passer les commandes d'un établissement (tablette).
INSERT INTO permission (code, label, category) VALUES
    ('passer_commande', 'Passer les commandes fournisseurs', 'COMMANDES');

INSERT INTO permission_preset_item (preset_code, permission_code) VALUES
    ('MANAGER', 'passer_commande');
