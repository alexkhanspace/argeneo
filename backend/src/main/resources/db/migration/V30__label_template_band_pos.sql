-- Position de la bande (logo/marque + badges de pied + prix) sur l'étiquette :
-- « bottom » (par défaut, sous le nom) ou « top » (au-dessus du nom).
ALTER TABLE label_template ADD COLUMN band_pos VARCHAR(10) NOT NULL DEFAULT 'bottom';
