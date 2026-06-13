-- ============================================================================
-- Données de référence : permissions atomiques + presets UI
-- (cf. CDC §4.3 — la liste granulaire est la vérité, les presets une commodité)
-- ============================================================================

INSERT INTO permission (code, label, category) VALUES
    ('saisir_ca',          'Saisir le chiffre d''affaires', 'SAISIE'),
    ('saisir_perte',       'Saisir les pertes',             'SAISIE'),
    ('saisir_mot_du_jour', 'Saisir le mot du jour',         'SAISIE'),
    ('voir_planning',      'Voir le planning',              'PLANNING'),
    ('editer_planning',    'Éditer le planning',            'PLANNING'),
    ('voir_recettes',      'Voir les recettes',             'PRODUCTION'),
    ('editer_recettes',    'Éditer les recettes',           'PRODUCTION'),
    ('voir_pnet',          'Voir le coût de revient (PNET)','PRODUCTION'),
    ('gerer_articles',     'Gérer les articles',            'PRODUCTION');

INSERT INTO permission_preset (code, label) VALUES
    ('VENDEUR',    'Vendeur'),
    ('MANAGER',    'Manager'),
    ('PRODUCTION', 'Production');

-- Vendeur : saisie quotidienne + lecture planning
INSERT INTO permission_preset_item (preset_code, permission_code) VALUES
    ('VENDEUR', 'saisir_ca'),
    ('VENDEUR', 'saisir_perte'),
    ('VENDEUR', 'saisir_mot_du_jour'),
    ('VENDEUR', 'voir_planning');

-- Manager : tout
INSERT INTO permission_preset_item (preset_code, permission_code) VALUES
    ('MANAGER', 'saisir_ca'),
    ('MANAGER', 'saisir_perte'),
    ('MANAGER', 'saisir_mot_du_jour'),
    ('MANAGER', 'voir_planning'),
    ('MANAGER', 'editer_planning'),
    ('MANAGER', 'voir_recettes'),
    ('MANAGER', 'editer_recettes'),
    ('MANAGER', 'voir_pnet'),
    ('MANAGER', 'gerer_articles');

-- Production : recettes / articles / coût + lecture planning
INSERT INTO permission_preset_item (preset_code, permission_code) VALUES
    ('PRODUCTION', 'voir_recettes'),
    ('PRODUCTION', 'editer_recettes'),
    ('PRODUCTION', 'voir_pnet'),
    ('PRODUCTION', 'gerer_articles'),
    ('PRODUCTION', 'voir_planning');
