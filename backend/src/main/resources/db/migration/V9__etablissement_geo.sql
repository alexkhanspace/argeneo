-- ============================================================================
-- Argeneo — Géolocalisation des établissements (pour la météo du calendrier).
-- Coordonnées renseignées via l'autocomplétion Base Adresse Nationale (BAN).
-- ============================================================================

ALTER TABLE etablissement
    ADD COLUMN latitude  DOUBLE PRECISION,
    ADD COLUMN longitude DOUBLE PRECISION;
