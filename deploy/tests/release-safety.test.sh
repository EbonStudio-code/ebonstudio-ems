#!/usr/bin/env bash
# Run ONLY in a disposable network-disabled container with no Docker socket.
set -euo pipefail
[[ "${EMS_SYNTHETIC_TEST_ONLY:-}" = true && ! -S /var/run/docker.sock ]] || exit 1
root=$(cd -- "$(dirname -- "$0")/../.." && pwd)
fixture=$(mktemp -d)
mkdir -p "$fixture/bin" "$fixture/backups" /opt/ems/shared
old=/opt/ems/releases/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
mkdir -p "$old/deploy"
cp "$root/deploy/compose.yaml" "$old/deploy/compose.yaml"
touch "$old/release.env" "$fixture/release.env" "$fixture/preflight"
printf 'result=passed\n' > "$fixture/recovery"
export EMS_PROJECT=ems-prod EMS_INGRESS=isolated
export EMS_MANIFEST="$fixture/release.env" EMS_PREFLIGHT_REPORT="$fixture/preflight"
export EMS_RECOVERY_REPORT="$fixture/recovery" EMS_BACKUP_DIR="$fixture/backups"
export EMS_BACKUP_RECIPIENT=synthetic EMS_PREVIOUS_RELEASE="$old"
export TEST_LOG="$fixture/commands" TEST_OLD="$old" PATH="$fixture/bin:$PATH"
cat > "$fixture/bin/hostname" <<'SH'
#!/bin/sh
echo products
SH
cat > "$fixture/bin/age" <<'SH'
#!/bin/sh
if [ "$FAIL_PHASE" = backup ]; then exit 1; fi
while [ "$#" -gt 0 ]; do
  if [ "$1" = --output ]; then shift; cat > "$1"; exit; fi
  shift
done
exit 1
SH
cat > "$fixture/bin/docker" <<'SH'
#!/bin/sh
echo "$*" >> "$TEST_LOG"
args="$*"
case "$1" in
  ps) exit 0 ;;
  volume|network)
    if [ "$2" = inspect ]; then
      if [ "$FAIL_PHASE" = collision ]; then echo unmanaged; exit 0; fi
      exit 1
    fi
    exit 0 ;;
  inspect)
    case "$args" in
      *PortBindings*) echo '{}' ;;
      *Health.Status*) echo healthy ;;
      *) exit 98 ;;
    esac
    exit 0 ;;
  compose) ;;
  *) exit 99 ;;
esac
previous=false
case "$args" in *"$TEST_OLD/release.env"*) previous=true;; esac
case "$args" in
  *'config --images'*) printf 'registry.invalid/ems@sha256:%064d\n' 0 ;;
  *'config --quiet'*|*' pull '*) ;;
  *'ps -aq api'*) if [ "$FAIL_PHASE" != first ]; then echo api-id; fi ;;
  *'ps -aq web'*) echo web-id ;;
  *'ps -q db'*) echo db-id ;;
  *' stop '*) ;;
  *'pg_dump'*) printf PGDMPsynthetic ;;
  *'psql'*) cat >/dev/null; echo 3 ;;
  *'run --rm --no-deps migrate'*)
    if [ "$FAIL_PHASE" = migration ] || [ "$FAIL_PHASE" = incompatible ]; then exit 1; fi ;;
  *'scripts/check-schema.js'*)
    if [ "$FAIL_PHASE" = incompatible ]; then exit 1; fi ;;
  *'up -d --no-deps'*)
    if [ "$previous" = false ] && { [ "$FAIL_PHASE" = health ] || [ "$FAIL_PHASE" = first ]; }; then exit 1; fi ;;
  *'scripts/healthcheck.js'*|*'node --input-type=module'*) ;;
  *) echo "Unexpected synthetic Docker command" >&2; exit 97 ;;
esac
SH
chmod +x "$fixture/bin/"*
reject_match() {
  if grep -Eq "$1" "$TEST_LOG"; then echo "Unexpected mutation in $FAIL_PHASE"; exit 1; fi
}
for phase in success backup migration health incompatible first missing-recovery missing-previous collision; do
  export FAIL_PHASE="$phase" EMS_PREVIOUS_RELEASE="$old" EMS_RECOVERY_REPORT="$fixture/recovery"
  : > "$TEST_LOG"
  if [[ "$phase" = first || "$phase" = missing-previous ]]; then EMS_PREVIOUS_RELEASE=; fi
  if [[ "$phase" = missing-recovery ]]; then EMS_RECOVERY_REPORT="$fixture/missing"; fi
  status=0
  bash "$root/deploy/scripts/release.sh" deploy --approve-production > "$fixture/result" 2>&1 || status=$?
  if [[ "$phase" = success ]]; then
    [[ "$status" = 0 ]]
    grep -q 'Internal EMS rollout complete' "$fixture/result"
    # The backup command must precede migration.
    backup_line=$(grep -n pg_dump "$TEST_LOG"); migration_line=$(grep -n 'run --rm --no-deps migrate' "$TEST_LOG")
    [[ "${backup_line%%:*}" -lt "${migration_line%%:*}" ]]
  else
    [[ "$status" != 0 ]]
    case "$phase" in
      backup|migration|health)
        grep -q 'previous same-schema application restored' "$fixture/result"
        grep -q "$old/release.env.*up -d --no-deps" "$TEST_LOG"
        if [[ "$phase" = backup ]]; then reject_match 'run --rm --no-deps migrate'; fi ;;
      incompatible|first)
        grep -q 'EMS application stopped; DB/volumes retained' "$fixture/result"
        reject_match "$old/release.env.*up -d --no-deps" ;;
      missing-recovery|missing-previous|collision)
        reject_match ' (pull|up|stop|run) ' ;;
    esac
  fi
  reject_match 'down|prune|volume rm| stop .* db$|up .* db$'
  echo "PASS release safety: $phase"
done
echo 'Synthetic command harness only; not a live deployment or encrypted restore proof.'
