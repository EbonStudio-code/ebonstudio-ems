#!/bin/sh
set -eu
# Executed by the official entrypoint ONLY for a fresh EMS-owned data volume.
EMS_OWNER_PASSWORD=$(cat /run/secrets/db_owner_password)
EMS_APP_PASSWORD=$(cat /run/secrets/db_app_password)
export EMS_OWNER_PASSWORD EMS_APP_PASSWORD
psql --no-psqlrc --set ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv owner_password EMS_OWNER_PASSWORD
\getenv app_password EMS_APP_PASSWORD
CREATE ROLE ems_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'owner_password';
CREATE ROLE ems_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'app_password';
ALTER DATABASE ems OWNER TO ems_owner;
REVOKE ALL ON DATABASE ems FROM PUBLIC;
GRANT CONNECT ON DATABASE ems TO ems_owner, ems_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO ems_app;
SQL
unset EMS_OWNER_PASSWORD EMS_APP_PASSWORD
