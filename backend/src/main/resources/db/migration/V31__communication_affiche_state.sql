-- État éditable de l'affichette (JSON : blocs + réglages + fond brut) pour rouvrir/éditer une affiche
-- enregistrée depuis n'importe quel appareil (source de vérité côté serveur).
ALTER TABLE communication ADD COLUMN affiche_state text;
