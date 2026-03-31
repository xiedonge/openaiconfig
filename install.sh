#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-config-manager-web}"
SERVICE_NAME="${SERVICE_NAME:-$APP_NAME}"
REPO_URL="${REPO_URL:-https://github.com/xiedonge/openaiconfig.git}"
REPO_REF="${REPO_REF:-main}"
APP_USER="${CONFIG_MANAGER_USER:-${SUDO_USER:-$(id -un)}}"
APP_GROUP="${CONFIG_MANAGER_GROUP:-$APP_USER}"
INSTALL_DIR="${INSTALL_DIR:-/opt/$APP_NAME}"
ENV_DIR="${ENV_DIR:-/etc/$APP_NAME}"
ENV_FILE="${ENV_FILE:-$ENV_DIR/$APP_NAME.env}"
APP_PORT="${APP_PORT:-3000}"
APP_HOSTNAME="${APP_HOSTNAME:-0.0.0.0}"
NODE_MAJOR="${NODE_MAJOR:-20}"
OPENCLAW_PROVIDER_KEY="${OPENCLAW_PROVIDER_KEY:-custom-goood-my}"
OPENCLAW_RESTART_COMMAND="${OPENCLAW_RESTART_COMMAND:-openclaw gateway restart}"
OPENCLAW_RESTART_TIMEOUT_MS="${OPENCLAW_RESTART_TIMEOUT_MS:-30000}"

log() {
  printf '\033[1;34m[%s]\033[0m %s\n' "$APP_NAME" "$1"
}

fail() {
  printf '\033[1;31m[%s]\033[0m %s\n' "$APP_NAME" "$1" >&2
  exit 1
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    fail "Please run this installer with sudo or as root."
  fi
}

require_supported_os() {
  if [[ ! -f /etc/os-release ]]; then
    fail "Unsupported system: /etc/os-release not found."
  fi

  # shellcheck disable=SC1091
  source /etc/os-release

  case "${ID:-}" in
    ubuntu|debian)
      ;;
    *)
      fail "This installer currently supports Debian/Ubuntu with systemd."
      ;;
  esac
}

resolve_user_home() {
  local entry
  entry="$(getent passwd "$APP_USER" || true)"
  [[ -n "$entry" ]] || fail "User '$APP_USER' does not exist."
  printf '%s' "$entry" | cut -d: -f6
}

random_string() {
  local length="${1:-32}"
  node -e "const crypto = require('node:crypto'); const length = Number(process.argv[1] || 32); const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; let output = ''; while (output.length < length) { const bytes = crypto.randomBytes(length); for (const byte of bytes) { if (output.length >= length) break; output += chars[byte % chars.length]; } } process.stdout.write(output);" "$length"
}

ensure_packages() {
  log "Installing required system packages"
  apt-get update
  apt-get install -y curl ca-certificates git build-essential
}

ensure_node() {
  local current_major=0

  if command -v node >/dev/null 2>&1; then
    current_major="$(node -p "process.versions.node.split('.')[0]")"
  fi

  if [[ "$current_major" -ge "$NODE_MAJOR" ]]; then
    log "Node.js $(node -v) already satisfies the requirement"
    return
  fi

  log "Installing Node.js ${NODE_MAJOR}.x"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
}

clone_or_update_repo() {
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    log "Updating existing repository in $INSTALL_DIR"
    git -C "$INSTALL_DIR" fetch --tags origin
    git -C "$INSTALL_DIR" checkout "$REPO_REF"
    if git -C "$INSTALL_DIR" rev-parse --verify "origin/$REPO_REF" >/dev/null 2>&1; then
      git -C "$INSTALL_DIR" reset --hard "origin/$REPO_REF"
    fi
  else
    log "Cloning repository into $INSTALL_DIR"
    rm -rf "$INSTALL_DIR"
    git clone --branch "$REPO_REF" "$REPO_URL" "$INSTALL_DIR"
  fi

  chown -R "$APP_USER:$APP_GROUP" "$INSTALL_DIR"
}

run_as_app_user() {
  local command="$1"
  runuser -u "$APP_USER" -- bash -lc "$command"
}

hash_admin_password() {
  local password="$1"
  run_as_app_user "cd '$INSTALL_DIR' && npm run hash-password -- '$password'" | tail -n 1
}

write_env_file() {
  local app_home="$1"
  local admin_username="${ADMIN_USERNAME:-admin}"
  local admin_password_hash="${ADMIN_PASSWORD_HASH:-}"
  local generated_password=""
  local session_secret="${SESSION_SECRET:-}"
  local codex_dir="${CODEX_CONFIG_DIR:-$app_home/.codex}"
  local openclaw_dir="${OPENCLAW_CONFIG_DIR:-$app_home/.openclaw}"
  local data_dir="${DATA_DIR:-$INSTALL_DIR/data}"

  log "Writing environment file to $ENV_FILE"
  mkdir -p "$ENV_DIR" "$data_dir"
  chown -R "$APP_USER:$APP_GROUP" "$data_dir"

  if [[ -z "$admin_password_hash" ]]; then
    if [[ -n "${ADMIN_PASSWORD:-}" ]]; then
      admin_password_hash="$(hash_admin_password "$ADMIN_PASSWORD")"
    else
      generated_password="$(random_string 20)"
      admin_password_hash="$(hash_admin_password "$generated_password")"
    fi
  fi

  if [[ -z "$session_secret" ]]; then
    session_secret="$(random_string 48)"
  fi

  cat >"$ENV_FILE" <<EOF
NODE_ENV=production
PORT=$APP_PORT
HOSTNAME=$APP_HOSTNAME
ADMIN_USERNAME=$admin_username
ADMIN_PASSWORD_HASH=$admin_password_hash
SESSION_SECRET=$session_secret
CODEX_CONFIG_DIR=$codex_dir
OPENCLAW_CONFIG_DIR=$openclaw_dir
OPENCLAW_PROVIDER_KEY=$OPENCLAW_PROVIDER_KEY
OPENCLAW_RESTART_COMMAND=$OPENCLAW_RESTART_COMMAND
OPENCLAW_RESTART_TIMEOUT_MS=$OPENCLAW_RESTART_TIMEOUT_MS
DATA_DIR=$data_dir
EOF

  chmod 600 "$ENV_FILE"

  if [[ -n "$generated_password" ]]; then
    log "Generated initial admin password: $generated_password"
    log "Save it now. The plain password is not stored anywhere else."
  fi
}

install_app_dependencies() {
  log "Installing npm dependencies"
  run_as_app_user "cd '$INSTALL_DIR' && npm ci"
  log "Building production bundle"
  run_as_app_user "cd '$INSTALL_DIR' && npm run build"
}

write_service_file() {
  local npm_bin
  npm_bin="$(command -v npm)"
  [[ -n "$npm_bin" ]] || fail "npm was not found after installation."

  log "Writing systemd unit to /etc/systemd/system/$SERVICE_NAME.service"
  cat >/etc/systemd/system/"$SERVICE_NAME".service <<EOF
[Unit]
Description=Config Manager Web
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_GROUP
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$npm_bin run start
Restart=always
RestartSec=5
TimeoutStartSec=120
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

[Install]
WantedBy=multi-user.target
EOF
}

enable_service() {
  log "Reloading systemd and enabling $SERVICE_NAME"
  systemctl daemon-reload
  systemctl enable --now "$SERVICE_NAME"
  systemctl status "$SERVICE_NAME" --no-pager || true
}

main() {
  require_root
  require_supported_os
  ensure_packages
  ensure_node

  local app_home
  app_home="$(resolve_user_home)"

  clone_or_update_repo
  install_app_dependencies
  write_env_file "$app_home"
  write_service_file
  enable_service

  log "Installation completed."
  log "Login URL: http://<server-ip>:$APP_PORT/login"
  log "Admin username: ${ADMIN_USERNAME:-admin}"
  log "If you passed ADMIN_PASSWORD, use that password to log in."
  log "If you did not pass ADMIN_PASSWORD, use the generated password shown above."
  log "Environment file: $ENV_FILE"
  log "Open http://<server-ip>:$APP_PORT/login to access the site."
}

main "$@"
