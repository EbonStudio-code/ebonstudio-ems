#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=deploy/scripts/common.sh
source "$(dirname -- "$0")/common.sh"
[[ "$EMS_PROJECT" = ems-restore-* && "$EMS_INGRESS" = isolated ]] || { echo "Restore is allowed only into a new isolated ems-restore-* project" >&2; exit 1; }
: "${EMS_RESTORE_ARCHIVE:?Set absolute encrypted dump path}"
: "${EMS_AGE_IDENTITY:?Set absolute protected age identity path}"
[[ "$EMS_RESTORE_ARCHIVE" = /* && "$EMS_AGE_IDENTITY" = /* ]] || exit 1
command -v age >/dev/null
check_images
check_namespace
# Refuse even an existing empty target volume. Never overwrite a database.
[[ -z "$(docker volume ls -q --filter "label=com.docker.compose.project=$EMS_PROJECT")" ]] || { echo "Restore project already has a volume. Use a new project."; exit 1; }
read -r expected _ < "$EMS_RESTORE_ARCHIVE.sha256"
actual=$(sha256sum "$EMS_RESTORE_ARCHIVE")
[[ "$expected" =~ ^[a-f0-9]{64}$ && "${actual%% *}" = "$expected" ]] || { echo "Backup checksum mismatch"; exit 1; }
dc up -d --wait --wait-timeout 120 db
# shellcheck disable=SC2016
age --decrypt --identity "$EMS_AGE_IDENTITY" "$EMS_RESTORE_ARCHIVE" \
  | dc exec -T db sh -c 'export PGPASSWORD="$(cat /run/secrets/db_owner_password)"; exec pg_restore --no-password --exit-on-error --single-transaction --no-owner --no-privileges -h 127.0.0.1 -U ems_owner -d ems'
dc run --rm --no-deps migrate
# Restore must not revive security sessions or send delayed production mail.
owner_sql <<'SQL'
BEGIN;
DELETE FROM sessions;
DELETE FROM account_tokens;
DELETE FROM email_outbox;
UPDATE users SET session_version=session_version+1;
COMMIT;
SELECT 'users=' || count(*) FROM users;
SELECT 'employees=' || count(*) FROM employees;
SELECT 'salary_slips=' || count(*) FROM salary_slips;
SELECT 'audit_events=' || count(*) FROM audit_events;
SELECT 'migrations=' || count(*) FROM schema_migrations;
SQL
dc run --rm --no-deps api scripts/check-schema.js
echo "Isolated database restored and security state invalidated. No web/worker/tunnel started."
echo "Compare aggregate counts, workflow invariants and restore duration with the backup manifest."
echo "Restore resources are retained for inspection; deletion requires separate approval."
