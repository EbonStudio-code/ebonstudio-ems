#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=deploy/scripts/common.sh
source "$(dirname -- "$0")/common.sh"
: "${EMS_BACKUP_DIR:?Set an absolute restricted backup directory outside this repository}"
: "${EMS_BACKUP_RECIPIENT:?Set the age public recipient, not a private key}"
[[ "$EMS_BACKUP_DIR" = /* && -d "$EMS_BACKUP_DIR" ]] || exit 1
command -v age >/dev/null
check_namespace
umask 077
target="$EMS_BACKUP_DIR/$EMS_PROJECT-$(date -u +%Y%m%dT%H%M%SZ)-$RANDOM.dump.age"
[[ ! -e "$target" && ! -e "$target.partial" ]] || exit 1
# pipefail ensures a failed pg_dump cannot be reported as a successful backup.
# shellcheck disable=SC2016
dc exec -T db sh -c 'export PGPASSWORD="$(cat /run/secrets/db_owner_password)"; exec pg_dump --no-password -h 127.0.0.1 -U ems_owner -d ems --format=custom --no-owner --no-privileges' \
  | age --encrypt --recipient "$EMS_BACKUP_RECIPIENT" --output "$target.partial"
mv -- "$target.partial" "$target"
sha256sum "$target" > "$target.sha256"
echo "Encrypted database backup created; verify and copy offsite using the approved destination."
echo "$target"
