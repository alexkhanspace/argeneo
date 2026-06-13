-- ============================================================================
-- Codification des articles : A0001 (acheté-revendu), R0001 (fabriqué/recette).
-- Séquence par tenant et par préfixe. Rétro-remplissage des articles existants.
-- ============================================================================

ALTER TABLE article ADD COLUMN code VARCHAR(10);

-- Rétro-remplissage : numérotation par tenant + type, dans l'ordre de création.
WITH numbered AS (
    SELECT id,
           CASE WHEN type = 'FABRIQUE' THEN 'R' ELSE 'A' END AS prefix,
           row_number() OVER (PARTITION BY tenant_id, type ORDER BY id) AS n
    FROM article
)
UPDATE article a
SET code = num.prefix || lpad(num.n::text, 4, '0')
FROM numbered num
WHERE a.id = num.id;

ALTER TABLE article ALTER COLUMN code SET NOT NULL;
ALTER TABLE article ADD CONSTRAINT uq_article_code UNIQUE (tenant_id, code);
