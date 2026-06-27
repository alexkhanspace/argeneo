-- Publications de communication archivées (brief, légende, réglages, visuel composé).
-- Tenant-scopées, établissement optionnel ; le visuel est un fichier sur disque.
CREATE TABLE communication (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id        BIGINT       NOT NULL REFERENCES tenant(id),
    etablissement_id BIGINT       REFERENCES etablissement(id),
    brief            TEXT,
    platform         VARCHAR(30),
    tone             VARCHAR(30),
    length           VARCHAR(20),
    ambiance         VARCHAR(120),
    instruction      TEXT,
    headline         VARCHAR(200),
    caption          TEXT,
    article_id       BIGINT       REFERENCES article(id),
    image_file       VARCHAR(120),
    image_mime       VARCHAR(100),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ
);
CREATE INDEX idx_communication_tenant ON communication(tenant_id);
