-- Couleurs de marque de l'enseigne (3 max) pour coloriser les documents PDF.
ALTER TABLE billing_settings
    ADD COLUMN brand_color1 VARCHAR(7),
    ADD COLUMN brand_color2 VARCHAR(7),
    ADD COLUMN brand_color3 VARCHAR(7);
