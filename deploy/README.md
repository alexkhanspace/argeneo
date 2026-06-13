# Argeneo — Déploiement production (runbook)

Fondation **infrastructure-as-code + runbook** pour déployer le SaaS Argeneo sur
un VPS OVH mono-serveur sous **Rocky Linux** (cible Rocky Linux 10, compatible 9).

> **Pas de Docker.** Installation native + `systemd` (choix volontaire, dit
> « legacy »). Une alternative `docker-compose` aurait été possible mais n'a
> **pas** été retenue, par préférence d'exploitation (moins de couches, debug
> direct via `journalctl`/`systemctl`).

## Architecture

```
  Internet ──HTTPS──> nginx (80/443, TLS via certbot)
                         │
                         ├── /            → fichiers statiques React  (/opt/argeneo/frontend)
                         └── /api         → proxy http://127.0.0.1:8080
                                                │
                                       Spring Boot (systemd: argeneo-backend)
                                                │
                                       PostgreSQL 18 (localhost:5432 uniquement)
```

- **Backend** : Spring Boot 4.1 / Java 17, fat jar `argeneo-backend-0.0.1-SNAPSHOT.jar`,
  port 8080, **Flyway applique les migrations automatiquement au démarrage**
  (aucune étape de schéma manuelle).
- **Frontend** : React + Vite + TypeScript, build statique `frontend/dist/`,
  appelle le backend via `/api` (relatif).
- **DB** : PostgreSQL, **jamais exposée publiquement** (localhost only + firewall).
- **Auth** : email + mot de passe (onprem), JWT signé par `ARGENEO_SECURITY_JWT_SECRET`.

## Sonde de connectivité (probe)

La sonde read-only a **réussi** lors de la préparation. Constats :

| Élément | Valeur |
|---|---|
| OS | **Rocky Linux 10.1** (`platform:el10`) |
| Utilisateur | `rocky` (sudo) |
| CPU | 2 vCPU |
| RAM | 3.5 GiB, **swap = 0** |
| nginx / java / psql | **non installés** (hôte vierge) |

Conséquences intégrées aux scripts :
- `JAVA_OPTS` plafonne le heap à **`-Xmx1g`** (pas de swap → on évite l'OOM-killer).
- `provision.sh` installe tout (java-17, nginx, postgresql) sur un hôte vierge.
- Voir [Note swap](#note-ram--swap) pour ajouter un fichier d'échange recommandé.

---

## Arborescence livrée

```
deploy/
├── README.md                         ← ce runbook
├── provision.sh                      ← provisioning serveur (1 fois, root)
├── deploy.sh                         ← déploiement d'une MAJ (depuis le Mac)
├── etc/
│   └── argeneo.env.example           ← modèle des secrets prod
├── systemd/
│   └── argeneo-backend.service       ← service du backend
├── nginx/
│   └── argeneo.fr.conf               ← vhost nginx (SPA + proxy /api)
├── postgres/
│   └── setup.sql                     ← rôle + base (idempotent)
└── backup/
    ├── pg_backup.sh                  ← dump quotidien pg_dump + rétention
    ├── argeneo-backup.service        ← oneshot du backup
    └── argeneo-backup.timer          ← planification quotidienne
```

---

## Prérequis

1. **DNS** : enregistrement **A** `argeneo.fr` → IP du VPS (et `www.argeneo.fr`
   si utilisé). Vérifier : `dig +short argeneo.fr`.
2. **Accès SSH** en tant que `rocky` avec sudo : `ssh rocky@argeneo.fr`.
3. Sur le **Mac** (pour `deploy.sh`) : JDK 17, Node/npm, `rsync`, `ssh`/`scp`.

---

## Ordre des opérations

### 1. Provisionner le serveur (une seule fois)

Copier le dossier `deploy/` sur le VPS puis lancer `provision.sh` en root.
Le script est **idempotent** (ré-exécutable sans danger).

```bash
# Depuis le Mac : envoyer le dossier deploy/ sur le serveur
rsync -az ./deploy/ rocky@argeneo.fr:/tmp/argeneo-deploy/

# Sur le serveur : provisionner
ssh rocky@argeneo.fr 'sudo bash /tmp/argeneo-deploy/provision.sh'
```

Ce que fait `provision.sh` :
- installe `java-17-openjdk-headless`, `nginx`, `postgresql-server` + contrib,
  `firewalld`, outils SELinux ;
- crée l'utilisateur système `argeneo` (sans shell de login) ;
- crée `/opt/argeneo` (+ `/opt/argeneo/frontend`) et `/etc/argeneo` (0750) ;
- `initdb` PostgreSQL si besoin, force `listen_addresses = 'localhost'`,
  active+démarre le service ;
- applique `postgres/setup.sql` (rôle + base `argeneo`) ;
- firewall : ouvre **80/443**, **laisse 5432 fermé** au monde ;
- SELinux : `setsebool -P httpd_can_network_connect 1` + label
  `httpd_sys_content_t` sur `/opt/argeneo/frontend` ;
- installe les units systemd + le vhost nginx, active le timer de backup.

> ⚠️ **Fallback Java** : si `java-17-openjdk-headless` est indisponible sur
> EL10, installer Temurin 17 :
> ```bash
> sudo rpm --import https://packages.adoptium.net/artifactory/api/gpg/key/public
> sudo tee /etc/yum.repos.d/adoptium.repo >/dev/null <<'EOF'
> [Adoptium]
> name=Adoptium
> baseurl=https://packages.adoptium.net/artifactory/rpm/rocky/$releasever/$basearch
> enabled=1
> gpgcheck=1
> gpgkey=https://packages.adoptium.net/artifactory/api/gpg/key/public
> EOF
> sudo dnf install -y temurin-17-jdk
> ```
> Puis adapter `ExecStart` du service si le binaire n'est pas `/usr/bin/java`.

### 2. Renseigner les secrets

```bash
ssh rocky@argeneo.fr
sudo cp /tmp/argeneo-deploy/etc/argeneo.env.example /etc/argeneo/argeneo.env  # déjà fait par provision.sh si absent
sudoedit /etc/argeneo/argeneo.env        # remplacer tous les CHANGE_ME_*
sudo chmod 600 /etc/argeneo/argeneo.env
sudo chown root:argeneo /etc/argeneo/argeneo.env
```

Générer des secrets forts (sur le Mac) :
```bash
openssl rand -base64 48                                   # JWT (>=32 octets)
openssl rand -base64 24 | tr -d '/+=' | head -c 32; echo  # mot de passe DB
```

Le mot de passe DB de l'env file **doit correspondre** au rôle PostgreSQL.
Après édition, **re-lancer** `provision.sh` une fois : il resynchronise le mot
de passe du rôle `argeneo` à partir de l'env file.

```bash
ssh rocky@argeneo.fr 'sudo bash /tmp/argeneo-deploy/provision.sh'
```

### 3. Premier déploiement (depuis le Mac)

```bash
./deploy/deploy.sh           # build backend+frontend, upload, restart, reload
```

`deploy.sh` :
1. `./gradlew bootJar` (backend) + `npm ci && npm run build` (frontend) ;
2. envoie le jar (upload atomique `.new` → `mv`) et synchronise `frontend/dist/`
   via `rsync --delete` ;
3. via SSH : remplace le jar, recale les droits/SELinux, `systemctl restart
   argeneo-backend`, `nginx -t && systemctl reload nginx`.

Variables surchargeables :
```bash
ARGENEO_HOST=rocky@argeneo.fr ./deploy/deploy.sh
SKIP_BUILD=1 ./deploy/deploy.sh     # réutilise les artefacts déjà construits
```

### 4. TLS (HTTPS) avec certbot

Une fois le DNS propagé et nginx servant en HTTP :

```bash
ssh rocky@argeneo.fr
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx -d argeneo.fr -d www.argeneo.fr --redirect -m admin@argeneo.fr --agree-tos
```

certbot injecte le bloc `server` 443 + la redirection HTTP→HTTPS, et installe un
timer de renouvellement automatique (`systemctl list-timers | grep certbot`).
Le bloc 443 de référence et l'en-tête HSTS sont commentés dans
`nginx/argeneo.fr.conf`. Tester le renouvellement : `sudo certbot renew --dry-run`.

---

## Déployer une mise à jour

Identique au premier déploiement — Flyway gère les migrations DB au démarrage :

```bash
./deploy/deploy.sh
```

Suivre le démarrage :
```bash
ssh rocky@argeneo.fr 'journalctl -u argeneo-backend -f'
```

Rollback applicatif rapide : conserver l'ancien jar et le restaurer.
```bash
# avant déploiement, garder une copie :
ssh rocky@argeneo.fr 'sudo cp /opt/argeneo/argeneo-backend.jar /opt/argeneo/argeneo-backend.jar.prev'
# pour revenir en arrière :
ssh rocky@argeneo.fr 'sudo mv /opt/argeneo/argeneo-backend.jar.prev /opt/argeneo/argeneo-backend.jar && sudo systemctl restart argeneo-backend'
```
> ⚠️ Un rollback applicatif **ne défait pas** une migration Flyway déjà
> appliquée. Pour un retour DB, utiliser une **restauration de backup**
> (ci-dessous).

---

## Sauvegardes (CDC §3.3) — quotidien, restaurable, exportable hors-site

- Script : `backup/pg_backup.sh` → `pg_dump -Fc` (format custom, restauration
  sélective), gzip, horodaté dans `/var/backups/argeneo/`.
- Planification : `argeneo-backup.timer` (tous les jours **03:30**, `Persistent`).
- Rétention locale : **14 jours** (`RETENTION_DAYS`, surchargeable).
- **Hors-site** : un **placeholder** clairement marqué dans `pg_backup.sh`
  (rclone S3/OVH Object Storage / rsync SSH / volume monté). **À configurer** —
  le CDC exige de ne **pas** se reposer uniquement sur le snapshot VPS.

Vérifier / déclencher manuellement :
```bash
ssh rocky@argeneo.fr 'systemctl list-timers argeneo-backup.timer'
ssh rocky@argeneo.fr 'sudo systemctl start argeneo-backup.service && journalctl -u argeneo-backup -n 20'
ssh rocky@argeneo.fr 'ls -lh /var/backups/argeneo/'
```

### Restaurer une sauvegarde

```bash
ssh rocky@argeneo.fr
# 1. choisir un dump
ls -lh /var/backups/argeneo/
DUMP=/var/backups/argeneo/argeneo-AAAAMMJJ-HHMMSS.dump.gz

# 2. décompresser
gunzip -k "$DUMP"          # produit le .dump (format custom)
RAW="${DUMP%.gz}"

# 3. arrêter le backend (évite les écritures pendant la restauration)
sudo systemctl stop argeneo-backend

# 4a. restauration "propre" dans la base existante (objets recréés)
sudo -u postgres pg_restore --clean --if-exists --no-owner \
     -d argeneo "$RAW"

# 4b. OU restauration dans une base neuve (recommandé pour un test)
sudo -u postgres createdb argeneo_restore
sudo -u postgres pg_restore --no-owner -d argeneo_restore "$RAW"

# 5. redémarrer
sudo systemctl start argeneo-backend
```

> Tester régulièrement une restauration sur une base jetable
> (`argeneo_restore`) : une sauvegarde non testée n'est pas une sauvegarde.

---

## Où sont les logs ?

| Composant | Commande |
|---|---|
| Backend | `journalctl -u argeneo-backend -f` |
| Backup | `journalctl -u argeneo-backup` |
| nginx (accès) | `sudo tail -f /var/log/nginx/argeneo.access.log` |
| nginx (erreurs) | `sudo tail -f /var/log/nginx/argeneo.error.log` |
| PostgreSQL | `sudo journalctl -u postgresql` ou `/var/lib/pgsql/data/log/` |
| certbot | `sudo journalctl -u certbot-renew.timer` |

---

## Note RAM / swap

Le VPS a **3.5 GiB de RAM et aucun swap**. Backend (JVM) + PostgreSQL coexistent.
`-Xmx1g` est volontairement prudent. Il est **recommandé d'ajouter un swap** de
sécurité pour absorber les pics :

```bash
ssh rocky@argeneo.fr
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## Sécurité — récapitulatif

- PostgreSQL : `listen_addresses = 'localhost'` **et** port 5432 fermé au
  firewall (double défense).
- `/etc/argeneo/argeneo.env` en **0600**, `root:argeneo`. Jamais commité (seul
  `*.example` l'est).
- Service backend durci : `NoNewPrivileges`, `ProtectSystem=strict`,
  `ProtectHome`, `PrivateTmp`, utilisateur non-login `argeneo`.
- SELinux **laissé actif** (`Enforcing`), booléen + label adaptés à nginx.
- TLS Let's Encrypt + redirection HTTP→HTTPS + (HSTS à activer une fois stable).
- En-têtes de sécurité nginx (`X-Content-Type-Options`, `X-Frame-Options`, …).

---

## Idempotence & sûreté de revue

Tous les scripts utilisent `set -euo pipefail`. `provision.sh` et `setup.sql`
sont **idempotents** (gardes `id`, `grep`, `IF NOT EXISTS`, `\gexec`). Aucun
script ne modifie le code source (`backend/`, `frontend/`) ni ne fait de
`git commit`. **Aucune action mutante n'a été exécutée sur le serveur** lors de
la préparation : seule la sonde read-only a tourné.
