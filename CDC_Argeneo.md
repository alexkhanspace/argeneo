# Cahier des charges — Argeneo

> Back-office SaaS de gestion pour artisans des métiers de bouche
> (boulangerie, boucherie, traiteur). Document de référence destiné au
> développement assisté (Claude Code).
> **Version 0.1 — cadrage initial.**

---

## 1. Vision produit

Argeneo permet à un artisan de piloter son activité au quotidien :
maîtriser le coût de revient de ses produits, suivre son chiffre d'affaires
et ses pertes, gérer ses recettes, ses devis/factures et le planning de ses
équipes — le tout en multi-établissements.

Le cœur de valeur : **quand le prix d'une matière première change (ex. le
beurre), le coût de revient des produits fabriqués qui l'utilisent (ex. le
croissant) est recalculé automatiquement.**

---

## 2. Glossaire

| Terme | Définition |
|---|---|
| **Tenant** | L'artisan / l'enseigne. C'est le compte client qui souscrit au SaaS. Possède 1 à N boulangeries. |
| **Boulangerie** | Un point de vente / établissement rattaché à un tenant. Unité de segmentation des données opérationnelles (CA, pertes, planning). |
| **Article** | Tout élément vendable. Deux natures : acheté-revendu ou fabriqué. |
| **Recette** | Nomenclature d'un article fabriqué (matières premières + sous-recettes) + méthode + durée. |
| **Matière première** | Ingrédient acheté, avec un prix net courant par unité de référence. |
| **PNET** | Prix net / coût de revient d'un article. |
| **Sous-recette** | Préparation intermédiaire réutilisable (ex. pâte feuilletée) entrant dans d'autres recettes. |

---

## 3. Architecture générale

### 3.1 Stack technique
- **Frontend** : React.js (build statique).
- **Backend** : Spring Boot (API REST).
- **Base de données** : PostgreSQL.
- **Reverse proxy / TLS** : Nginx (terminaison HTTPS, sert le build React, route `/api` vers Spring Boot).
- **Conteneurisation** : Docker Compose recommandé (reproductibilité déploiement + sauvegarde).

### 3.2 Hébergement
- VPS OVH, mono-serveur au démarrage (tous tenants sur la même instance).
- Cible de configuration : 8 vCores / 24 Go RAM / 200 Go SSD NVMe.
- PostgreSQL **non exposé publiquement** (réseau interne uniquement).
- Auth : **e-mail + mot de passe** uniquement (pas d'OAuth/Google au démarrage — exigence « onprem »).

### 3.3 Sauvegarde
- Sauvegarde VPS automatisée J-1 (niveau OVH).
- **Exigence supplémentaire** : dump PostgreSQL applicatif quotidien, restaurable finement, exportable off-site. (À ne pas se reposer uniquement sur le snapshot VPS pour de la donnée client.)

---

## 4. Multi-tenant & sécurité

### 4.1 Modèle d'isolation
- **Base unique partagée**, isolation logique par `tenant_id` présent sur toutes les tables métier.
- Filtre d'isolation automatique (ex. filtre Hibernate / intercepteur) appliqué systématiquement — **non négociable, à câbler dès le socle**.
- Hiérarchie : `Tenant (artisan) → Boulangerie(s) → Users`.
- Le cas « artisan à 1 boulangerie » est un cas particulier du cas « N boulangeries » : un seul modèle.

### 4.2 Rôles
| Rôle | Portée | Droits |
|---|---|---|
| **Super-Admin** | Plateforme (éditeur) | Au-dessus des tenants. Crée et gère les tenants, support, facturation SaaS. N'est pas un utilisateur métier. |
| **Patron** | Son tenant | Toutes permissions sur son tenant : crée boulangeries, crée employés, paramètre le tenant, **attribue les permissions des employés**. |
| **Employé** | Une ou plusieurs boulangeries | Permissions composées par le patron (pas de jeu de droits figé). |

### 4.3 Permissions
- **Modèle granulaire en base** : permissions atomiques (ex. `saisir_ca`, `saisir_perte`, `voir_planning`, `editer_planning`, `voir_recettes`, `voir_pnet`, `gerer_articles`…).
- **Attribution contextualisée par boulangerie** : l'unité d'attribution est `(user, boulangerie, permission)`. Un même employé peut être manager à Lyon et simple vendeur à Villeurbanne.
- Chaque permission = une authority Spring Security.
- **Presets UI** (« Manager », « Vendeur », « Production ») = paquets de permissions pré-cochés, pour simplifier la saisie côté patron. Les presets ne sont qu'une commodité d'interface ; la vérité est la liste granulaire en base.

---

## 5. Fonctionnalités

### 5.1 Gestion des articles
- Catalogue de tous les articles vendables (= « fichier articles »).
- Deux natures d'article (`type`) :
  - **ACHAT_REVENTE** (ex. canette) : pas de recette. PNET = prix d'achat.
  - **FABRIQUE** (ex. croissant) : possède une fiche recette. PNET = calculé par le moteur de coût.
- Attributs communs : nom, type, unité, prix de vente, TVA, rattachement tenant.

### 5.2 Gestion des recettes (articles fabriqués)
- Saisie de la nomenclature : matières premières **et/ou** sous-recettes (récursif).
- Méthode de préparation (texte) + durée.
- Rendement (quantité produite) + taux de perte.
- Calcul du **PNET** via le moteur de coût (voir §6).
- **Paramétrable au niveau tenant** : les recettes sont soit **communes à l'enseigne**, soit **propres à chaque boulangerie**. Ce paramètre est un réglage du tenant.
- Le **PNET peut varier par boulangerie** même à recette commune (prix d'achat des matières différents selon la région).

### 5.3 Calendrier / saisie quotidienne
Par boulangerie, par jour :
- **Saisie du CA** : global, manuel (en attendant une interconnexion caisse type Crisalid — voir §7). Saisi par le manager.
- **Saisie de la perte** : globale, manuelle (même logique que le CA en V1).
- **Mot du jour** : note libre du manager. Visible par l'équipe. Sert aussi d'**input contextuel pour l'analyse IA** (capte ce qu'aucune API ne sait : match local, fête de quartier, travaux…).
- **Analyse IA des jours à venir** : voir §8.
- **Exigence d'architecture** : historiser proprement le CA quotidien dès la V1 (même global et manuel) — c'est le stock de données qui débloquera la prévision calibrée (V2).

### 5.4 Gestion Facture / Devis
- **Reportée après le MVP** (décision de cadrage).
- À terme : suivi devis → facture classique, **conformité Factur-X obligatoire** (réforme facturation électronique FR).
- Note d'architecture : prévoir numérotation séquentielle légale, archivage, format Factur-X dès la conception de ce module.

### 5.5 Planning équipe
- Cadrage du planning hebdomadaire de l'équipe (par boulangerie).
- Export / diffusion hebdomadaire aux équipiers : e-mail, et/ou tableau d'affichage dynamique.
- **Badgeuse physique** : hors MVP / évolution future. Prévoir une API d'ingestion de pointages pour ne pas se fermer la porte.

---

## 6. Moteur de calcul de coût (PNET)

Brique centrale, à isoler en **domaine pur** (sans dépendance JPA/Spring, testable unitairement).

- Coût d'un article fabriqué = somme des coûts des composants (matières + sous-recettes), ajustée du rendement et du taux de perte.
- **Sous-recettes récursives** avec **détection de cycle** et mémoïsation.
- **Conversion d'unités** par dimension (masse/volume/pièce) : permet d'acheter en « sac de 25 kg » et de consommer en « g » dans la recette.
- Prix matière utilisé : **dernier prix d'achat** par défaut (PMP/CUMP envisageable en évolution).
- Recalcul à la volée : le PNET n'a pas besoin d'être stocké, il se recalcule à partir des prix nets courants.

> Une implémentation de référence du moteur (Java pur) et un schéma de base
> initial existent déjà en prototype et valident le comportement attendu
> (effet « le prix du beurre monte → le croissant suit »).

---

## 7. Intégrations externes (futures)

- **Caisse / encaissement** (ex. Crisalid) : remontée automatique du CA détaillé par produit. Prévoir un point d'intégration dès la conception ; tant qu'absent, saisie manuelle globale.
- **Badgeuse** : ingestion de pointages (voir §5.5).

---

## 8. Analyse IA — paliers

L'attente doit être calibrée sur la donnée disponible.

### V1 — Conseil contextuel (dès le démarrage, sans historique)
- Entrées : **météo**, **données calendaires** (fériés, vacances scolaires par zone, ponts — via API publiques officielles), **mot du jour**, et **événements locaux/actu** (ciblés, géolocalisés/datés).
- Traitement : synthèse en langage naturel par un LLM (API Claude).
- Sortie : **aide à la décision qualitative**, pas une prévision chiffrée fiable.
  Ex. « Demain pluie + lendemain de pont → contexte favorable aux viennoiseries du matin, snacking de midi plus faible. »
- **Hiérarchie de fiabilité des sources** :
  1. Données calendaires structurées (fiables, gratuites, géolocalisables).
  2. Mot du jour (déclaratif, terrain, précieux).
  3. Actu générale via recherche web (la plus large, la moins fiable) — **à borner** : usage ciblé (événement majeur ville/région à une date) plutôt que veille large, pour éviter les corrélations hallucinées.

### V2 — Prévision calibrée (quand l'historique CA est suffisant)
- Corrélation des signaux avec l'historique CA réel du tenant/boulangerie.
- Devient une vraie prévision chiffrée, calibrée sur les données propres.
- Conditionnée à : volume d'historique suffisant + idéalement CA détaillé (interconnexion caisse).

---

## 9. Périmètre MVP & ordre de développement

### Dans le MVP
Socle multi-tenant + auth + permissions, gestion articles, gestion recettes + moteur PNET, calendrier/saisie quotidienne (CA, perte, mot du jour), analyse IA V1 (conseil contextuel), planning équipe.

### Hors MVP (évolutions)
Module Facture/Devis (Factur-X), interconnexion caisse (CA détaillé), badgeuse, analyse IA V2 (prévision calibrée), PMP/CUMP.

### Première tranche verticale à développer
**Socle : Auth + multi-tenant + gestion users/permissions**, de bout en bout (DB → API → écran). Justification : fondation sur laquelle tout se branche, et zone où une erreur coûte le plus cher à corriger.

Contenu de cette tranche :
1. Modèle de données : `tenant`, `boulangerie`, `user`, permissions `(user, boulangerie, permission)`, presets.
2. Filtre d'isolation `tenant_id` automatique (transverse).
3. Auth e-mail + mot de passe (Spring Security), gestion de session/JWT.
4. Parcours Super-Admin : création/gestion d'un tenant.
5. Parcours Patron : création de boulangeries, création d'employés, attribution des permissions par boulangerie (avec presets).
6. Écrans React correspondants + garde d'accès côté front alignée sur les authorities.

---

## 10. Décisions actées (journal)

- Métiers cibles : boulangerie, boucherie, traiteur.
- Forme : SaaS multi-tenant. Tenant = artisan/enseigne (1..N boulangeries).
- Auth : e-mail + mot de passe uniquement (onprem).
- Isolation : base unique + `tenant_id`.
- Recettes : paramétrable au niveau tenant (commune enseigne OU propre boulangerie) ; PNET variable par boulangerie.
- Permissions : granulaires + presets UI, contextualisées par boulangerie.
- Prix matière pour PNET : dernier prix d'achat.
- Calcul du coût : en Java (domaine pur), pas en SQL.
- Sous-recettes : nécessaires (récursif + détection de cycle).
- CA & perte : saisie manuelle globale en V1.
- Mot du jour : note libre, visible équipe, nourrit l'IA.
- IA : V1 conseil contextuel (météo + calendaire + mot du jour + actu bornée), V2 prévision calibrée.
- Facture/Devis : reporté post-MVP, Factur-X à terme.
- Badgeuse : évolution future, prévoir API d'ingestion.
- Première tranche : socle auth + multi-tenant + permissions.

---

## 11. Points à trancher ultérieurement

- Format exact de diffusion du planning (e-mail, tableau d'affichage dynamique : techno ?).
- Modalités précises Factur-X (à l'ouverture du module facture).
- Choix API météo et API événements locaux.
- Politique de rétention / RGPD des données (CA, plannings, employés).
- Stratégie de montée en charge au-delà du mono-serveur (si croissance tenants).
