-- ============================================================================
-- Argeneo — description libre de l'établissement (type, spécialités, style).
-- Sert notamment de contexte à l'analyse de tendance (IA) pour cadrer les
-- conseils (ex. « boulangerie traditionnelle française », pas de propositions
-- hors gamme).
-- ============================================================================

ALTER TABLE etablissement ADD COLUMN description TEXT;
