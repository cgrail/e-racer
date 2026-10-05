#!/usr/bin/env bash
# ============================================================
# Electro Car Racer — auto-update / deploy
#
# Fetches origin and, when origin/main has moved past what is
# currently deployed, hard-resets this checkout to it (the deploy
# checkout must mirror origin exactly — local edits here are
# discarded), re-syncs and rebuilds /opt/electro-car-racer and
# restarts the service.
#
# install.sh registers this as a systemd timer (every 5 min), and as a
# path unit that runs it at once when the server's POST /update (a
# GitHub webhook on push) writes /run/electro-car-racer/update:
#   systemctl list-timers electro-car-racer-update.timer
#   journalctl -u electro-car-racer-update
#
# Manual use, from the server checkout:
#   sudo ./update.sh            # deploy only if origin/main moved
#   sudo ./update.sh --force    # rebuild + restart no matter what
#
# A restart is harmless to the server itself (it keeps no state),
# but it ends the online session that is running.
# ============================================================
set -euo pipefail

APP=electro-car-racer
APP_DIR=/opt/$APP
APP_USER=ecr
APP_HOME=/var/lib/$APP
DEPLOYED_REV_FILE=$APP_HOME/deployed-rev
UPDATE_FILE=/run/$APP/update # the webhook's request, which starts this through $APP-update.path
BRANCH="${BRANCH:-main}"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { printf '\033[1;32m==> %s\033[0m\n' "$*"; }
die() { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run with sudo: sudo ./update.sh [--force]"
# this run takes the webhook's request, whatever happens below (a request left
# in place would start it again and again); one that comes in from here on
# may be newer than the fetch, so the path unit runs this again when it ends
rm -f "$UPDATE_FILE"
git -C "$SRC_DIR" rev-parse --is-inside-work-tree > /dev/null 2>&1 \
  || die "$SRC_DIR is not a git checkout"
id -u "$APP_USER" > /dev/null 2>&1 || die "user '$APP_USER' missing — run install.sh first"

# never run two deploys at once (timer tick vs manual run)
exec 9> /run/lock/$APP-deploy.lock
flock -n 9 || die "another deploy is already running"

# git runs as the checkout's owner: keeps ownership clean and avoids
# git's "dubious ownership" refusal when root touches a user's repo
OWNER="$(stat -c %U "$SRC_DIR")"
git_src() { runuser -u "$OWNER" -- git -C "$SRC_DIR" "$@"; }

git_src fetch --quiet origin "$BRANCH"
remote_rev="$(git_src rev-parse "origin/$BRANCH")"
deployed_rev="$(cat "$DEPLOYED_REV_FILE" 2> /dev/null || true)"

if [[ $remote_rev == "$deployed_rev" && ${1:-} != --force ]]; then
  exit 0 # up to date — stay quiet in the 5-minute timer logs
fi

log "deploying ${deployed_rev:-nothing} → $remote_rev"
git_src reset --hard "origin/$BRANCH"

# mirror install.sh's deploy steps: sync, build unprivileged, lock down
rsync -a --delete --exclude .git --exclude node_modules --exclude dist --exclude .claude "$SRC_DIR/" "$APP_DIR/"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
runuser -u "$APP_USER" -- bash -c "cd '$APP_DIR' && HOME='$APP_HOME' npm ci --no-audit --no-fund && HOME='$APP_HOME' npm run build"
chown -R "root:$APP_USER" "$APP_DIR"
chmod -R g-w,o-rwx "$APP_DIR"

systemctl restart $APP

# only mark deployed after a successful build + restart, so a failed
# attempt is retried on the next timer tick
echo "$remote_rev" > "$DEPLOYED_REV_FILE"
log "deployed $remote_rev"
