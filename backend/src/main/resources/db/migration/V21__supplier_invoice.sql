-- Factures fournisseurs scannées (archivage compta + source de mise à jour des prix MP).
-- Tenant-scopées (comme les matières premières) ; l'établissement est un tag optionnel.
CREATE TABLE supplier_invoice (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id       BIGINT        NOT NULL REFERENCES tenant(id),
    etablissement_id BIGINT       REFERENCES etablissement(id),
    supplier_name   VARCHAR(255),
    invoice_number  VARCHAR(100),
    invoice_date    DATE,
    total_ht        NUMERIC(12, 2),
    total_vat       NUMERIC(12, 2),
    total_ttc       NUMERIC(12, 2),
    scan_file       VARCHAR(120),
    scan_mime       VARCHAR(100),
    status          VARCHAR(20)   NOT NULL DEFAULT 'NOUVEAU',
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    applied_at      TIMESTAMPTZ,
    CONSTRAINT chk_supplier_invoice_status CHECK (status IN ('NOUVEAU', 'TRAITEE'))
);
CREATE INDEX idx_supplier_invoice_tenant ON supplier_invoice(tenant_id);

CREATE TABLE supplier_invoice_line (
    id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id              BIGINT        NOT NULL REFERENCES tenant(id),
    invoice_id             BIGINT        NOT NULL REFERENCES supplier_invoice(id) ON DELETE CASCADE,
    position               INT           NOT NULL DEFAULT 0,
    designation            VARCHAR(500)  NOT NULL,
    quantity               NUMERIC(12, 3),
    unit                   VARCHAR(30),
    unit_price_ht          NUMERIC(12, 4),
    line_total_ht          NUMERIC(12, 2),
    vat_rate               NUMERIC(5, 4),
    raw_material_id        BIGINT        REFERENCES raw_material(id),
    applied_price_per_unit NUMERIC(12, 4),
    applied                BOOLEAN       NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_supplier_invoice_line_invoice ON supplier_invoice_line(invoice_id);
