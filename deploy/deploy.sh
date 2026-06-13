#!/usr/bin/env bash
# =============================================================================
# Argeneo — deploy an update from your DEV MACHINE (Mac) to the VPS.
# =============================================================================
# Builds the backend fat jar + the frontend, ships them over SSH, then restarts
# the backend service and reloads nginx on the server. No Docker.
#
#   ./deploy/deploy.sh                 # build + deploy to argeneo.fr
#   ARGENEO_HOST=rocky@1.2.3.4 ./deploy/deploy.sh
#   SKIP_BUILD=1 ./deploy/deploy.sh    # reuse existing build artifacts
#
# Prerequisites on the Mac: a working JDK 17 (for ./gradlew), Node/npm, rsync,
# and SSH access as the deploy user (default rocky@argeneo.fr).
# =============================================================================
set -euo pipefail

# --- Parameters (override via env) ------------------------------------------
ARGENEO_HOST="${ARGENEO_HOST:-rocky@argeneo.fr}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/opt/argeneo}"
REMOTE_JAR="${REMOTE_APP_DIR}/argeneo-backend.jar"
REMOTE_FRONTEND="${REMOTE_APP_DIR}/frontend/"
SERVICE="${SERVICE:-argeneo-backend}"
SKIP_BUILD="${SKIP_BUILD:-0}"

# Resolve repo root = parent of this script's dir (works from anywhere).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${REPO_ROOT}/backend"
FRONTEND_DIR="${REPO_ROOT}/frontend"
JAR_PATH="${BACKEND_DIR}/build/libs/argeneo-backend-0.0.1-SNAPSHOT.jar"

log()  { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# --- 1. Build ---------------------------------------------------------------
if [[ "${SKIP_BUILD}" != "1" ]]; then
  log "Building backend (./gradlew bootJar)..."
  ( cd "${BACKEND_DIR}" && ./gradlew --no-daemon clean bootJar )

  log "Building frontend (npm ci && npm run build)..."
  ( cd "${FRONTEND_DIR}" && npm ci && npm run build )
else
  log "SKIP_BUILD=1 — using existing artifacts."
fi

[[ -f "${JAR_PATH}" ]]                || die "Backend jar not found at ${JAR_PATH}. Run a build."
[[ -d "${FRONTEND_DIR}/dist" ]]       || die "Frontend dist/ not found. Run a build."
[[ -f "${FRONTEND_DIR}/dist/index.html" ]] || die "frontend/dist/index.html missing — bad build?"

# --- 2. Ship artifacts ------------------------------------------------------
# Jar -> a temp path first, then atomic mv on the server (no half-written jar).
log "Uploading backend jar to ${ARGENEO_HOST}:${REMOTE_JAR} ..."
scp "${JAR_PATH}" "${ARGENEO_HOST}:${REMOTE_JAR}.new"

log "Syncing frontend dist -> ${ARGENEO_HOST}:${REMOTE_FRONTEND} ..."
# --delete removes stale assets from previous builds. Trailing slashes matter.
rsync -az --delete \
  -e ssh \
  "${FRONTEND_DIR}/dist/" \
  "${ARGENEO_HOST}:${REMOTE_FRONTEND}"

# --- 3. Activate on the server ----------------------------------------------
# One SSH session: swap jar atomically, fix ownership/SELinux, restart, reload.
log "Activating release on ${ARGENEO_HOST} (restart backend, reload nginx)..."
ssh "${ARGENEO_HOST}" bash -s <<REMOTE
set -euo pipefail
sudo mv -f "${REMOTE_JAR}.new" "${REMOTE_JAR}"
sudo chown argeneo:argeneo "${REMOTE_JAR}"
sudo chown -R argeneo:argeneo "${REMOTE_APP_DIR}/frontend"

# Re-apply SELinux label on freshly rsynced frontend files (no-op if disabled).
if command -v restorecon >/dev/null 2>&1; then
  sudo restorecon -R "${REMOTE_APP_DIR}/frontend" || true
fi

echo "Restarting ${SERVICE}..."
sudo systemctl restart "${SERVICE}"

# Give it a moment, then report status (non-fatal if still warming up).
sleep 3
sudo systemctl --no-pager --full status "${SERVICE}" | head -n 12 || true

echo "Reloading nginx..."
sudo nginx -t && sudo systemctl reload nginx
REMOTE

log "Deploy complete. Tail logs with:  ssh ${ARGENEO_HOST} 'journalctl -u ${SERVICE} -f'"
