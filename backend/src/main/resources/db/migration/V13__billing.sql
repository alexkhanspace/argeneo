-- ============================================================================
-- Argeneo — Facturation : émetteur, paramètres, clients, devis & factures.
-- billing_profile / billing_settings sont liés à l'établissement (déjà scopé
-- tenant) ; client / billing_document / billing_document_line sont scopés
-- tenant (colonne tenant_id, filtrée par @TenantId).
-- ============================================================================

-- Émetteur (1-1 par établissement) : identité légale & coordonnées bancaires.
CREATE TABLE billing_profile (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    etablissement_id BIGINT        NOT NULL UNIQUE REFERENCES etablissement(id),
    siren            VARCHAR(9),
    siret            VARCHAR(14),
    tva_intra        VARCHAR(20),
    rcs              VARCHAR(100),
    ape              VARCHAR(10),
    legal_form       VARCHAR(100),
    share_capital    NUMERIC(14, 2),
    iban             VARCHAR(34),
    bic              VARCHAR(11),
    contact_email    VARCHAR(255),
    contact_phone    VARCHAR(30),
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Paramètres & mentions de facturation (1-1 par établissement).
CREATE TABLE billing_settings (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    etablissement_id   BIGINT      NOT NULL UNIQUE REFERENCES etablissement(id),
    legal_mentions     TEXT,
    payment_terms_days INTEGER,
    late_penalty       TEXT,
    footer             TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client (scopé tenant) : professionnel ou particulier.
CREATE TABLE client (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id   BIGINT       NOT NULL REFERENCES tenant(id),
    name        VARCHAR(255) NOT NULL,
    kind        VARCHAR(20)  NOT NULL,
    siret       VARCHAR(14),
    tva_intra   VARCHAR(20),
    email       VARCHAR(255),
    phone       VARCHAR(30),
    address     VARCHAR(500),
    postal_code VARCHAR(20),
    city        VARCHAR(120),
    country     VARCHAR(80)  DEFAULT 'France',
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_client_kind CHECK (kind IN ('PRO', 'PARTICULIER'))
);
CREATE INDEX idx_client_tenant ON client(tenant_id);

-- Document de facturation (scopé tenant) : devis ou facture.
CREATE TABLE billing_document (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id        BIGINT       NOT NULL REFERENCES tenant(id),
    etablissement_id BIGINT       NOT NULL REFERENCES etablissement(id),
    client_id        BIGINT       NOT NULL REFERENCES client(id),
    type             VARCHAR(20)  NOT NULL,
    number           VARCHAR(50),                       -- null tant que brouillon
    status           VARCHAR(20)  NOT NULL DEFAULT 'BROUILLON',
    issue_date       DATE,
    due_date         DATE,
    currency         VARCHAR(3)   NOT NULL DEFAULT 'EUR',
    total_ht         NUMERIC(12, 2) DEFAULT 0,
    total_vat        NUMERIC(12, 2) DEFAULT 0,
    total_ttc        NUMERIC(12, 2) DEFAULT 0,
    notes            TEXT,
    terms            TEXT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_bdoc_type CHECK (type IN ('DEVIS', 'FACTURE')),
    CONSTRAINT chk_bdoc_status CHECK (
        status IN ('BROUILLON', 'EMIS', 'ACCEPTE', 'REFUSE', 'PAYE', 'ANNULE')
    )
);
CREATE INDEX idx_bdoc_tenant      ON billing_document(tenant_id);
CREATE INDEX idx_bdoc_tenant_type ON billing_document(tenant_id, type);

-- Ligne d'un document de facturation (scopée tenant).
CREATE TABLE billing_document_line (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id     BIGINT       NOT NULL REFERENCES tenant(id),
    document_id   BIGINT       NOT NULL REFERENCES billing_document(id) ON DELETE CASCADE,
    position      INTEGER      NOT NULL,
    designation   VARCHAR(500) NOT NULL,
    article_id    BIGINT       REFERENCES article(id),
    quantity      NUMERIC(12, 3) NOT NULL DEFAULT 1,
    unit          VARCHAR(20),
    unit_price_ht NUMERIC(12, 4) NOT NULL DEFAULT 0,
    vat_rate      NUMERIC(5, 4)  NOT NULL DEFAULT 0,
    discount_rate NUMERIC(5, 4)  NOT NULL DEFAULT 0,
    line_total_ht NUMERIC(12, 2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_bline_tenant   ON billing_document_line(tenant_id);
CREATE INDEX idx_bline_document ON billing_document_line(document_id);
