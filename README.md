# Argeneo

Back-office SaaS de gestion pour artisans des métiers de bouche (boulangerie,
boucherie, traiteur). Multi-tenant, isolation logique par `tenant_id`.

Voir [`CDC_Argeneo.md`](./CDC_Argeneo.md) pour le cahier des charges complet.

## Stack

| Couche | Techno |
|---|---|
| Frontend | React 19 + Vite + TypeScript |
| Backend | Spring Boot 4.1 (Java 17) — Gradle (Kotlin DSL) |
| Base de données | PostgreSQL 18 (locale, Homebrew) |
| Migrations | Flyway |
| Auth | E-mail + mot de passe, JWT, Spring Security |

## Première tranche (MVP, slice 1)

Socle **Auth + multi-tenant + users/permissions** de bout en bout
(DB → API → écran). C'est la fondation sur laquelle tout se branche.

## Prérequis (macOS)

- JDK 17 (Temurin) — le toolchain Gradle cible Java 17.
- Node 20+ / npm.
- PostgreSQL 18 lancé en local (`brew services` ou launchd).

## Démarrage

### 1. Base de données

PostgreSQL doit tourner en local avec la base et le rôle applicatif :

```sql
CREATE ROLE argeneo LOGIN PASSWORD 'argeneo_local_dev';
CREATE DATABASE argeneo OWNER argeneo;
```

(Flyway crée le schéma au démarrage du backend.)

### 2. Backend

```bash
cd backend
./gradlew bootRun
# API sur http://localhost:8080
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# UI sur http://localhost:5173 (proxy /api -> :8080)
```

## Comptes

Au premier démarrage, le backend amorce un **Super-Admin** (configurable dans
`application.yml`, ou via les variables d'env `ARGENEO_BOOTSTRAP_ADMIN_*`) :

```
admin@argeneo.local / Admin123!
```

Le Super-Admin crée les tenants (avec leur patron). Le patron crée ses
boulangeries, ses employés et attribue les permissions par boulangerie.

## Endpoints (slice 1)

| Méthode | Chemin | Rôle |
|---|---|---|
| POST | `/api/auth/login` | public |
| GET | `/api/me` | authentifié |
| POST/GET | `/api/admin/tenants` | Super-Admin |
| POST/GET | `/api/boulangeries` | Patron |
| POST/GET | `/api/users` | Patron |
| GET/PUT | `/api/users/{id}/permissions` | Patron |
| GET | `/api/permissions`, `/api/permission-presets` | Patron |

## Structure

```
ArGeNeo/
├── backend/    # Spring Boot — domaine pur + infra + API REST
├── frontend/   # React + Vite + TS
└── CDC_Argeneo.md
```
