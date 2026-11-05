#!/usr/bin/env bash
set -Eeuo pipefail
# shellcheck source=deploy/scripts/common.sh
source "$(dirname -- "$0")/common.sh"
mode=${1:-}
[[ "$mode" = deploy || "$mode" = rollback ]] || { echo "Usage: release.sh deploy|rollback --approve-production"; exit 1; }
[[ "${2:-}" = --approve-production && "$EMS_PROJECT" = ems-prod ]] || { echo "Explicit production authorization is required"; exit 1; }
[[ "$(hostname -s)" = products && ! -e /etc/pve ]] || { echo "Not the approved guest"; exit 1; }
: "${EMS_PREFLIGHT_REPORT:?Set the reviewed read-only inventory report path}"
[[ -f "$EMS_PREFLIGHT_REPORT" && -n "$(find "$EMS_PREFLIGHT_REPORT" -mmin -60 -print)" ]] || { echo "A reviewed inventory less than one hour old is required"; exit 1; }
: "${EMS_RECOVERY_REPORT:?Set the reviewed encrypted restore/offsite evidence path}"
if [[ ! -f "$EMS_RECOVERY_REPORT" || -z "$(find "$EMS_RECOVERY_REPORT" -mtime -30 -print)" ]] \
  || ! grep -qx 'result=passed' "$EMS_RECOVERY_REPORT"; then
  echo "A reviewed successful recovery drill less than 30 days old is required"; exit 1
fi
if [[ "$mode" = deploy ]]; then
  : "${EMS_BACKUP_DIR:?Set the protected backup directory}"
  : "${EMS_BACKUP_RECIPIENT:?Set the approved public age recipient}"
  [[ "$EMS_BACKUP_DIR" = /* && -d "$EMS_BACKUP_DIR" ]] || { echo "Backup directory unavailable"; exit 1; }
  command -v age >/dev/null
fi
command -v flock >/dev/null
exec 9>/opt/ems/shared/release.lock
flock -n 9 || { echo "Another EMS release is active"; exit 1; }
dc config --quiet
check_images
check_namespace
previous=${EMS_PREVIOUS_RELEASE:-}
if [[ -n "$previous" ]]; then
  [[ "$previous" =~ ^/opt/ems/releases/[a-f0-9]{40}$ && -f "$previous/release.env" && -f "$previous/deploy/compose.yaml" ]] \
    || { echo "Previous release must be a reviewed immutable EMS release"; exit 1; }
  PREVIOUS_COMPOSE=(docker compose --project-name "$EMS_PROJECT" --env-file "$previous/release.env" -f "$previous/deploy/compose.yaml")
  if [[ "$EMS_INGRESS" != isolated ]]; then PREVIOUS_COMPOSE+=(-f "$previous/deploy/compose.$EMS_INGRESS.yaml"); fi
  saved_compose=("${COMPOSE[@]}")
  COMPOSE=("${PREVIOUS_COMPOSE[@]}")
  dc config --quiet
  check_images
  COMPOSE=("${saved_compose[@]}")
elif [[ -n "$(dc ps -aq api)" ]]; then
  echo "An existing application requires EMS_PREVIOUS_RELEASE for recovery"; exit 1
fi
# Do not silently remove or add an already-approved ingress on an upgrade.
web_id=$(dc ps -aq web)
if [[ -n "$web_id" ]]; then
  bindings=$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$web_id")
  if [[ "$EMS_INGRESS" = loopback ]]; then
    [[ "$bindings" = *'"HostIp":"127.0.0.1"'* ]] || { echo "Existing ingress differs; separate route approval required"; exit 1; }
  else
    [[ "$bindings" = '{}' || "$bindings" = null ]] || { echo "Refusing to remove an existing port binding"; exit 1; }
  fi
fi
app_health() {
  dc exec -T api ems-entrypoint scripts/healthcheck.js || return
  dc exec -T api node --input-type=module -e '
    import {get} from "node:http";
    for (const [path,status] of [["/login",200],["/api/v1/health/live",200],["/api/v1/health/ready",404]]) {
      await new Promise((resolve,reject)=> {
        const request=get("http://web:8080"+path,{headers:{Host:"ems.ebonstudio.com"},signal:AbortSignal.timeout(5000)},response=>{
          response.resume(); response.on("end",()=>response.statusCode===status?resolve():reject(new Error("Internal proxy health failed")));
        });
        request.on("error",reject);
      });
    }'
}
restore_previous() {
  [[ -n "$previous" ]] || return 1
  COMPOSE=("${PREVIOUS_COMPOSE[@]}")
  # Schema must match NOW, after any migrations. Never down-migrate or replace DB.
  dc run --rm --no-deps api scripts/check-schema.js || return
  dc up -d --no-deps --wait --wait-timeout 120 api web mail-worker || return
  app_health
}
application_changed=false
on_failure() {
  local status=$?
  trap - ERR
  set +e
  if [[ "$application_changed" = true ]]; then
    if restore_previous; then
      echo "Deployment failed; previous same-schema application restored. Release remains failed."
    else
      dc stop --timeout 30 api web mail-worker
      echo "Automatic recovery unavailable or schema-incompatible. EMS application stopped; DB/volumes retained. Operator forward fix or approved restore/cutover required."
    fi
  fi
  exit "$status"
}
trap on_failure ERR
dc pull api web migrate mail-worker
db_id=$(dc ps -q db)
if [[ -z "$db_id" ]]; then
  [[ "$mode" = deploy ]] || { echo "Cannot roll back without the existing database"; exit 1; }
  # An existing stopped DB must not be replaced implicitly.
  [[ -z "$(dc ps -aq db)" ]] || { echo "Existing database is stopped. Investigate before deployment."; exit 1; }
  dc pull db
  dc up -d --wait --wait-timeout 120 db
else
  [[ "$(docker inspect --format '{{.State.Health.Status}}' "$db_id")" = healthy ]] || { echo "Existing database is unhealthy"; exit 1; }
fi
if [[ "$mode" = deploy ]]; then
  # Back up even a fresh schema; recovery proof was checked before any mutation.
  application_changed=true
  dc stop --timeout 45 api mail-worker
  count=$(printf "SELECT count(*) FROM pg_tables WHERE schemaname='public';\n" | owner_sql)
  [[ "$count" =~ ^[0-9]+$ ]] || { echo "Cannot confirm current schema"; false; }
  bash "$ROOT/deploy/scripts/backup.sh"
  dc run --rm --no-deps migrate
else
  # Old release must match the CURRENT schema; no automatic down migration/restore.
  dc run --rm --no-deps api scripts/check-schema.js
fi
application_changed=true
dc up -d --no-deps --wait --wait-timeout 120 api web mail-worker
app_health
trap - ERR
echo "Internal EMS rollout complete. Verify smoke checks before changing any public route."
echo "Ingress is deliberately not started or changed by this script."
