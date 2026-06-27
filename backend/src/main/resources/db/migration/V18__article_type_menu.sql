-- Autorise le nouveau type d'article MENU dans la contrainte CHECK.
ALTER TABLE article DROP CONSTRAINT chk_article_type;
ALTER TABLE article
    ADD CONSTRAINT chk_article_type CHECK (type IN ('ACHAT_REVENTE', 'FABRIQUE', 'MENU'));
