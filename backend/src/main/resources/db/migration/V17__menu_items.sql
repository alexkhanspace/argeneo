-- Composition d'un article de type MENU : liste d'articles composants + quantité.
CREATE TABLE menu_item (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           BIGINT NOT NULL,
    menu_article_id     BIGINT NOT NULL REFERENCES article(id) ON DELETE CASCADE,
    component_article_id BIGINT NOT NULL REFERENCES article(id),
    quantity            NUMERIC(12, 3) NOT NULL DEFAULT 1,
    position            INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_menu_item_menu ON menu_item (menu_article_id);
