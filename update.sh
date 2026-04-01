#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-config-manager-web}"
SERVICE_NAME="${SERVICE_NAME:-$APP_NAME}"
INSTALL_DIR="${INSTALL_DIR:-/opt/$APP_NAME}"
REPO_URL="${REPO_URL:-https://github.com/xiedonge/openaiconfig.git}"
REPO_REF="${REPO_REF:-main}"
APP_USER="${APP_USER:-$(stat -c '%U' "$INSTALL_DIR" 2>/dev/null || id -un)}"
APP_GROUP="${APP_GROUP:-$(stat -c '%G' "$INSTALL_DIR" 2>/dev/null || id -gn)}"
DATA_DIR="${DATA_DIR:-$INSTALL_DIR/data}"
UPDATE_STATUS_FILE="${UPDATE_STATUS_FILE:-$DATA_DIR/system-update.json}"
UPDATE_LOCK_FILE="${UPDATE_LOCK_FILE:-$DATA_DIR/system-update.lock}"
CURRENT_STEP="initialization"
STARTED_AT=""
CURRENT_HEAD=""
TARGET_HEAD=""
HEARTBEAT_PID=""

log() {
  printf '\033[1;34m[%s-update]\033[0m %s\n' "$APP_NAME" "$1"
}

fail() {
  printf '\033[1;31m[%s-update]\033[0m %s\n' "$APP_NAME" "$1" >&2
  exit 1
}

set_running_status() {
  local message="$1"
  write_status "running" "$message" "$STARTED_AT" "" "$CURRENT_HEAD" "$TARGET_HEAD"
}

start_status_heartbeat() {
  local message="$1"
  stop_status_heartbeat
  (
    while true; do
      sleep 15
      write_status "running" "$message" "$STARTED_AT" "" "$CURRENT_HEAD" "$TARGET_HEAD"
    done
  ) &
  HEARTBEAT_PID="$!"
}

stop_status_heartbeat() {
  if [[ -n "$HEARTBEAT_PID" ]]; then
    kill "$HEARTBEAT_PID" >/dev/null 2>&1 || true
    wait "$HEARTBEAT_PID" >/dev/null 2>&1 || true
    HEARTBEAT_PID=""
  fi
}

write_status() {
  local state="$1"
  local message="$2"
  local started_at="${3:-}"
  local finished_at="${4:-}"
  local from_commit="${5:-}"
  local to_commit="${6:-}"

  node - "$UPDATE_STATUS_FILE" "$state" "$message" "$started_at" "$finished_at" "$from_commit" "$to_commit" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const [file, state, message, startedAt, finishedAt, fromCommit, toCommit] = process.argv.slice(2);
fs.mkdirSync(path.dirname(file), { recursive: true });
const payload = {
  state,
  message,
  startedAt: startedAt || null,
  finishedAt: finishedAt || null,
  fromCommit: fromCommit || null,
  toCommit: toCommit || null,
  updatedAt: new Date().toISOString(),
};
fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
NODE
}

handle_error() {
  stop_status_heartbeat
  local finished_at
  finished_at="$(date -Iseconds)"
  write_status "failed" "Update failed during ${CURRENT_STEP}." "$STARTED_AT" "$finished_at" "$CURRENT_HEAD" "$TARGET_HEAD"
}

trap 'handle_error' ERR
trap 'stop_status_heartbeat' EXIT

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    fail "Please run this updater as root."
  fi
}

require_installation() {
  [[ -d "$INSTALL_DIR/.git" ]] || fail "Repository was not found in $INSTALL_DIR."
  id "$APP_USER" >/dev/null 2>&1 || fail "User '$APP_USER' does not exist."
  command -v flock >/dev/null 2>&1 || fail "flock was not found."
  command -v node >/dev/null 2>&1 || fail "node was not found."
  mkdir -p "$DATA_DIR"
}

run_as_app_user() {
  local command="$1"
  runuser -u "$APP_USER" -- bash -lc "$command"
}

main() {
  require_root
  require_installation

  exec 9>"$UPDATE_LOCK_FILE"
  if ! flock -n 9; then
    log "Another update is already running."
    exit 0
  fi

  STARTED_AT="$(date -Iseconds)"
  write_status "running" "Update started in background." "$STARTED_AT"

  CURRENT_STEP="read current version"
  set_running_status "Reading current version."
  CURRENT_HEAD="$(git -C "$INSTALL_DIR" rev-parse HEAD)"

  CURRENT_STEP="fetch remote updates"
  set_running_status "Fetching remote updates."
  start_status_heartbeat "Fetching remote updates."
  log "Fetching latest changes from $REPO_URL ($REPO_REF)"
  git -C "$INSTALL_DIR" remote set-url origin "$REPO_URL"
  git -C "$INSTALL_DIR" fetch --tags origin
  git -C "$INSTALL_DIR" checkout "$REPO_REF"
  stop_status_heartbeat

  if git -C "$INSTALL_DIR" rev-parse --verify "origin/$REPO_REF" >/dev/null 2>&1; then
    TARGET_HEAD="$(git -C "$INSTALL_DIR" rev-parse "origin/$REPO_REF")"
  else
    TARGET_HEAD="$(git -C "$INSTALL_DIR" rev-parse "$REPO_REF")"
  fi

  if [[ "$CURRENT_HEAD" == "$TARGET_HEAD" ]]; then
    local finished_at
    finished_at="$(date -Iseconds)"
    write_status "success" "Already up to date." "$STARTED_AT" "$finished_at" "$CURRENT_HEAD" "$TARGET_HEAD"
    log "Already up to date at $CURRENT_HEAD"
    exit 0
  fi

  CURRENT_STEP="update code"
  set_running_status "Updating application code."
  start_status_heartbeat "Updating application code."
  log "Updating $CURRENT_HEAD -> $TARGET_HEAD"
  git -C "$INSTALL_DIR" reset --hard "$TARGET_HEAD"
  chown -R "$APP_USER:$APP_GROUP" "$INSTALL_DIR"
  stop_status_heartbeat

  CURRENT_STEP="install dependencies"
  set_running_status "Installing dependencies. This step can take a few minutes."
  start_status_heartbeat "Installing dependencies. This step can take a few minutes."
  log "Installing npm dependencies"
  run_as_app_user "cd '$INSTALL_DIR' && npm ci"
  stop_status_heartbeat

  CURRENT_STEP="build application"
  set_running_status "Building application. This step can take a few minutes."
  start_status_heartbeat "Building application. This step can take a few minutes."
  log "Building production bundle"
  run_as_app_user "cd '$INSTALL_DIR' && npm run build"
  stop_status_heartbeat

  CURRENT_STEP="restart service"
  set_running_status "Restarting web service."
  start_status_heartbeat "Restarting web service."
  log "Reloading systemd and restarting $SERVICE_NAME"
  systemctl daemon-reload
  systemctl restart "$SERVICE_NAME"
  systemctl is-active --quiet "$SERVICE_NAME" || fail "Service '$SERVICE_NAME' failed to start after update."
  stop_status_heartbeat

  local finished_at
  finished_at="$(date -Iseconds)"
  write_status "success" "Update completed and service restarted." "$STARTED_AT" "$finished_at" "$CURRENT_HEAD" "$TARGET_HEAD"
  log "Update completed successfully."
}

main "$@"
