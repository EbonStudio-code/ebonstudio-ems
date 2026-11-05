#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
EMS_PROJECT=${EMS_PROJECT:-ems-prod}
EMS_MANIFEST=${EMS_MANIFEST:-/opt/ems/shared/release.env}
EMS_INGRESS=${EMS_INGRESS:-isolated}
[[ "$EMS_PROJECT" =~ ^ems-(prod|restore-[a-z0-9-]+|ci-[a-z0-9-]+)$ ]] || { echo "Refusing non-EMS project" >&2; exit 1; }
[[ "$EMS_MANIFEST" = /* && -f "$EMS_MANIFEST" ]] || { echo "An absolute release manifest is required" >&2; exit 1; }
COMPOSE=(docker compose --project-name "$EMS_PROJECT" --env-file "$EMS_MANIFEST" -f "$ROOT/deploy/compose.yaml")
case "$EMS_INGRESS" in
  isolated) ;;
  loopback|tunnel) COMPOSE+=(-f "$ROOT/deploy/compose.$EMS_INGRESS.yaml") ;;
  *) echo "Invalid EMS_INGRESS" >&2; exit 1 ;;
esac
dc() { "${COMPOSE[@]}" "$@"; }
owner_sql() {
  # Expansion happens inside the database container, not on the host.
  # shellcheck disable=SC2016
  dc exec -T db sh -c 'export PGPASSWORD="$(cat /run/secrets/db_owner_password)"; exec psql --no-psqlrc --no-password -h 127.0.0.1 -U ems_owner -d ems -v ON_ERROR_STOP=1 -At'
}
check_images() {
  local image images
  images=$(dc config --images)
  [[ -n "$images" ]] || exit 1
  while IFS= read -r image; do
    [[ "$image" =~ @sha256:[a-f0-9]{64}$ ]] || { echo "Production requires digest-pinned images" >&2; exit 1; }
  done <<< "$images"
}
check_namespace() {
  local id label
  # A colliding named resource may have NO Compose labels and evade label filters.
  if docker volume inspect "${EMS_PROJECT}_pgdata" >/dev/null 2>&1; then
    label=$(docker volume inspect --format '{{index .Labels "com.ebonstudio.ems"}}/{{index .Labels "com.docker.compose.project"}}' "${EMS_PROJECT}_pgdata")
    [[ "$label" = "true/$EMS_PROJECT" ]] || { echo "Volume-name collision with non-EMS storage. Stop." >&2; exit 1; }
  fi
  for id in database application ingress mail-egress; do
    if docker network inspect "${EMS_PROJECT}_$id" >/dev/null 2>&1; then
      label=$(docker network inspect --format '{{index .Labels "com.ebonstudio.ems"}}/{{index .Labels "com.docker.compose.project"}}' "${EMS_PROJECT}_$id")
      [[ "$label" = "true/$EMS_PROJECT" ]] || { echo "Network-name collision with non-EMS infrastructure. Stop." >&2; exit 1; }
    fi
  done
  for id in $(docker ps -aq --filter "label=com.docker.compose.project=$EMS_PROJECT"); do
    label=$(docker inspect --format '{{index .Config.Labels "com.ebonstudio.ems"}}' "$id")
    [[ "$label" = "true" ]] || { echo "Existing project container is not EMS-managed. Stop." >&2; exit 1; }
  done
  for id in $(docker volume ls -q --filter "label=com.docker.compose.project=$EMS_PROJECT"); do
    label=$(docker volume inspect --format '{{index .Labels "com.ebonstudio.ems"}}' "$id")
    [[ "$label" = "true" ]] || { echo "Existing project volume is not EMS-managed. Stop." >&2; exit 1; }
  done
  for id in $(docker network ls -q --filter "label=com.docker.compose.project=$EMS_PROJECT"); do
    label=$(docker network inspect --format '{{index .Labels "com.ebonstudio.ems"}}' "$id")
    [[ "$label" = "true" ]] || { echo "Existing project network is not EMS-managed. Stop." >&2; exit 1; }
  done
}
