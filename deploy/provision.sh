#!/usr/bin/env bash
# =============================================================================
# Argeneo — server provisioning (run ONCE on the VPS as root or via sudo)
# =============================================================================
# Target: Rocky Linux 10 (also fine on RHEL/Rocky 9). No Docker — native +
# systemd. Idempotent: every step is guarded so re-running is safe.
#
# Usage (copy this file to the server first, or run via deploy bootstrap):
#   scp deploy/provision.sh rocky@argeneo.fr:/tmp/
#   ssh rocky@argeneo.fr 'sudo bash /tmp/provision.sh'
#
# What it does NOT do: deploy the app jar/frontend (that's deploy.sh), write the
# real secrets (you do that in /etc/argeneo/argeneo.env), or obtain TLS certs
# (that's certbot — see README).
# =============================================================================
set -euo pipefail

# --- Tunables ---------------------------------------------------------------
APP_USER="argeneo"
APP_HOME="/opt/argeneo"
FRONTEND_DIR="${APP_HOME}/frontend"
ETC_DIR="/etc/argeneo"
ENV_FILE="${ETC_DIR}/argeneo.env"
PG_DB="argeneo"
PG_ROLE="argeneo"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log()  { printf '\n\033[1;32m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }

if [[ $EUID -ne 0 ]]; then
  echo "This script must run as root (use sudo)." >&2
  exit 1
fi

# Detect EL major version for any version-specific bits (informational).
EL_VER="$(. /etc/os-release && echo "${VERSION_ID%%.*}")"
log "Detected EL major version: ${EL_VER:-unknown}"

# ---------------------------------------------------------------------------
# 1. Packages
# ---------------------------------------------------------------------------
log "Installing base packages (java, nginx, postgresql, tools)..."
# java-21-openjdk-headless: backend runtime (EL10 ships Java 21; the app targets
# Java 17 bytecode and runs fine on 21). policycoreutils-python-utils provides
# semanage (used for the SELinux fcontext on the frontend dir).
dnf install -y \
  java-21-openjdk-headless \
  nginx \
  postgresql-server postgresql-contrib \
  firewalld \
  policycoreutils-python-utils \
  rsync gzip tar

# ---------------------------------------------------------------------------
# 2. System user + directories
# ---------------------------------------------------------------------------
if ! id "${APP_USER}" &>/dev/null; then
  log "Creating system user '${APP_USER}' (no login shell)..."
  useradd --system --home-dir "${APP_HOME}" --shell /usr/sbin/nologin "${APP_USER}"
else
  log "User '${APP_USER}' already exists — skipping."
fi

log "Creating directories ${APP_HOME}, ${FRONTEND_DIR}, ${ETC_DIR}..."
install -d -o "${APP_USER}" -g "${APP_USER}" -m 0755 "${APP_HOME}"
install -d -o "${APP_USER}" -g "${APP_USER}" -m 0755 "${FRONTEND_DIR}"
# /etc/argeneo readable by the app group only; the env file itself is 600.
install -d -o root -g "${APP_USER}" -m 0750 "${ETC_DIR}"

# Seed the env file from the example if it's not there yet (placeholders only).
if [[ ! -f "${ENV_FILE}" ]]; then
  if [[ -f "${SCRIPT_DIR}/etc/argeneo.env.example" ]]; then
    log "Seeding ${ENV_FILE} from example (EDIT IT and set real secrets!)."
    install -o root -g "${APP_USER}" -m 0600 \
      "${SCRIPT_DIR}/etc/argeneo.env.example" "${ENV_FILE}"
  else
    warn "No argeneo.env.example next to this script; create ${ENV_FILE} manually."
  fi
else
  log "${ENV_FILE} already present — leaving it untouched."
  chmod 600 "${ENV_FILE}" || true
  chown root:"${APP_USER}" "${ENV_FILE}" || true
fi

# ---------------------------------------------------------------------------
# 3. PostgreSQL — initdb (if needed), localhost-only, enable+start
# ---------------------------------------------------------------------------
PGDATA_DEFAULT="/var/lib/pgsql/data"
if [[ ! -f "${PGDATA_DEFAULT}/PG_VERSION" ]]; then
  log "Initialising PostgreSQL data directory..."
  /usr/bin/postgresql-setup --initdb
else
  log "PostgreSQL already initialised — skipping initdb."
fi

# Enforce localhost-only listening (defence in depth alongside the firewall).
PG_CONF="${PGDATA_DEFAULT}/postgresql.conf"
if [[ -f "${PG_CONF}" ]]; then
  if ! grep -qE "^[[:space:]]*listen_addresses[[:space:]]*=[[:space:]]*'localhost'" "${PG_CONF}"; then
    log "Pinning listen_addresses = 'localhost' in postgresql.conf..."
    sed -i -E "s/^[[:space:]]*#?[[:space:]]*listen_addresses.*/listen_addresses = 'localhost'/" "${PG_CONF}"
    grep -qE "^listen_addresses" "${PG_CONF}" || echo "listen_addresses = 'localhost'" >> "${PG_CONF}"
  fi
fi

# Local TCP connections must use password auth (scram-sha-256), not the EL
# default 'ident' — the Spring Boot app connects over 127.0.0.1:5432 with a
# password. Without this, startup fails: "Ident authentication failed".
PG_HBA="${PGDATA_DEFAULT}/pg_hba.conf"
if [[ -f "${PG_HBA}" ]]; then
  if grep -qE "^host[[:space:]]+all[[:space:]]+all[[:space:]]+(127\.0\.0\.1/32|::1/128)[[:space:]]+ident" "${PG_HBA}"; then
    log "Switching local TCP auth to scram-sha-256 in pg_hba.conf..."
    sed -i -E '/^host[[:space:]]+all[[:space:]]+all[[:space:]]+(127\.0\.0\.1\/32|::1\/128)[[:space:]]+/ s/ident[[:space:]]*$/scram-sha-256/' "${PG_HBA}"
  fi
fi

log "Enabling and starting PostgreSQL..."
systemctl enable --now postgresql
# Reload to pick up postgresql.conf / pg_hba.conf changes if it was already up.
systemctl reload postgresql || true

# Create role + database (idempotent). Pull the password from the env file if it
# has already been edited; otherwise create with a placeholder and warn loudly.
DB_PW="$(grep -E '^SPRING_DATASOURCE_PASSWORD=' "${ENV_FILE}" 2>/dev/null | cut -d= -f2- || true)"
if [[ -z "${DB_PW}" || "${DB_PW}" == CHANGE_ME* ]]; then
  warn "DB password in ${ENV_FILE} is still a placeholder."
  warn "Creating the role with a TEMPORARY password 'argeneo_change_me'."
  warn "Edit ${ENV_FILE}, then re-run:  sudo bash $0   (it will sync the password)."
  DB_PW="argeneo_change_me"
fi

if [[ -f "${SCRIPT_DIR}/postgres/setup.sql" ]]; then
  log "Applying postgres/setup.sql (role + database, idempotent)..."
  sudo -u postgres psql -v ON_ERROR_STOP=1 \
       -v argeneo_pw="${DB_PW}" \
       -f "${SCRIPT_DIR}/postgres/setup.sql"
else
  warn "postgres/setup.sql not found next to script; create role/db manually."
fi

# ---------------------------------------------------------------------------
# 4. Firewall — open 80/443, keep 5432 closed to the world
# ---------------------------------------------------------------------------
log "Configuring firewalld (open http/https, 5432 stays closed)..."
systemctl enable --now firewalld
firewall-cmd --permanent --add-service=http  >/dev/null
firewall-cmd --permanent --add-service=https >/dev/null
# Note: we deliberately do NOT add 5432 — Postgres stays localhost-only.
firewall-cmd --reload >/dev/null

# ---------------------------------------------------------------------------
# 5. SELinux — let nginx proxy to localhost:8080 and read the frontend dir
# ---------------------------------------------------------------------------
if command -v getenforce &>/dev/null && [[ "$(getenforce)" != "Disabled" ]]; then
  log "Configuring SELinux booleans / contexts for nginx..."
  setsebool -P httpd_can_network_connect 1
  # Label the frontend dir so nginx (httpd_t) may serve it. /opt is not a
  # default web root, so set the httpd_sys_content_t context recursively.
  if command -v semanage &>/dev/null; then
    semanage fcontext -a -t httpd_sys_content_t "${FRONTEND_DIR}(/.*)?" 2>/dev/null \
      || semanage fcontext -m -t httpd_sys_content_t "${FRONTEND_DIR}(/.*)?"
    restorecon -Rv "${FRONTEND_DIR}" || true
  else
    warn "semanage not available; install policycoreutils-python-utils."
  fi
else
  log "SELinux disabled — skipping SELinux configuration."
fi

# ---------------------------------------------------------------------------
# 6. nginx config + systemd units (copied from this repo if present)
# ---------------------------------------------------------------------------
if [[ -f "${SCRIPT_DIR}/nginx/argeneo.fr.conf" ]]; then
  log "Installing nginx site config..."
  install -m 0644 "${SCRIPT_DIR}/nginx/argeneo.fr.conf" /etc/nginx/conf.d/argeneo.fr.conf
  install -d -m 0755 /var/www/html   # ACME challenge webroot
fi

if [[ -f "${SCRIPT_DIR}/systemd/argeneo-backend.service" ]]; then
  log "Installing backend systemd unit..."
  install -m 0644 "${SCRIPT_DIR}/systemd/argeneo-backend.service" \
    /etc/systemd/system/argeneo-backend.service
fi
if [[ -f "${SCRIPT_DIR}/backup/argeneo-backup.service" ]]; then
  log "Installing backup systemd unit + timer..."
  install -m 0644 "${SCRIPT_DIR}/backup/argeneo-backup.service" \
    /etc/systemd/system/argeneo-backup.service
  install -m 0644 "${SCRIPT_DIR}/backup/argeneo-backup.timer" \
    /etc/systemd/system/argeneo-backup.timer
  install -m 0755 "${SCRIPT_DIR}/backup/pg_backup.sh" /usr/local/bin/argeneo-pg-backup.sh
  install -d -o "${APP_USER}" -g "${APP_USER}" -m 0750 /var/backups/argeneo
fi

systemctl daemon-reload

log "Enabling nginx (started but app not deployed yet)..."
nginx -t && systemctl enable --now nginx

# Enable the backend service but do NOT start it — the jar isn't deployed yet.
systemctl enable argeneo-backend || true
# Enable the daily backup timer.
if systemctl list-unit-files | grep -q '^argeneo-backup.timer'; then
  systemctl enable --now argeneo-backup.timer || true
fi

# ---------------------------------------------------------------------------
log "Provisioning complete."
cat <<EOF

NEXT STEPS
  1. Edit ${ENV_FILE} with real secrets, then re-run this script once to sync
     the DB password (or run postgres/setup.sql manually).
  2. From your Mac, deploy the app:   ./deploy/deploy.sh
  3. Point DNS: A record argeneo.fr -> this VPS IP (and www if used).
  4. Obtain TLS:  sudo dnf install certbot python3-certbot-nginx
                  sudo certbot --nginx -d argeneo.fr -d www.argeneo.fr
  5. Verify:      systemctl status argeneo-backend
                  curl -I https://argeneo.fr
EOF
