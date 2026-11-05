# EMS production deployment: VM 101

**Status: local preparation, not a production deployment or launch approval.**
See [execution log](25-production-execution-log.md) for measured results and blockers.
Earlier deployment proposals are superseded here for this target.

## Architecture and isolation

- Debian 13 guest `products`, Proxmox VM 101. No Proxmox-host changes.
- React 19/TypeScript/Vite static frontend in non-root Nginx.
- Express 5/Node 24 ESM API, PostgreSQL **18** (not MongoDB).
- Production containers use pinned official Alpine images on the Debian guest.
  API npm/Yarn and unused Nginx modules are absent; PostgreSQL starts as its
  non-root `postgres` user without the unused `gosu` binary.
- One company, CEO/Employee roles, modular monolith. No Redis or Kubernetes.
- Same browser origin: `https://ems.ebonstudio.com`, API at `/api/v1`.
- Dedicated project `ems-prod`, labelled containers/networks/volume. Never join
  another workload's database or network. No `container_name`, external volumes,
  host network, privileged mode, Docker socket, or host-wide bind mount.
- PostgreSQL 18 storage is mounted at `/var/lib/postgresql`, with
  `PGDATA=/var/lib/postgresql/18/docker`. Do not reuse a volume from another major.
- Database and API have **no published ports**. Base Compose is private.
  Loopback ingress is an explicit overlay, never `0.0.0.0:5432/3000/8080`.
- Runtime API and mail worker run as UID 1000 with read-only roots, dropped
  capabilities, bounded `/tmp`, PID/CPU/memory limits and rotated logs.
- `ems_owner` owns schema/migrations; `ems_app` has only explicit table grants;
  the cluster admin password is never mounted into the API.
- Dedicated internal database/application bridges. Only worker and ingress need
  outbound connectivity. PostgreSQL traffic is unencrypted inside the isolated VM
  bridge, not across the LAN. Moving DB outside the guest requires verified TLS.

Configured steady-state ceiling is approximately 3.2 GiB RAM and 4 vCPU (plus
optional tunnel). This is not a capacity benchmark. Reserve at least 4 GiB spare
RAM, CPU headroom, and measured database/backup disk growth after inventory.
The stated 32 GiB / 8 vCPU / 200 GB VM totals do not prove available capacity.

## Verified controls and remaining security decisions

Argon2id passwords, hashed opaque sessions and account tokens, exact-origin CSRF,
Secure/HttpOnly/SameSite=Lax host-only `__Host-ems` cookies, 30-minute idle /
8-hour absolute sessions, rotation/revocation, persistent hashed rate limits,
role/ownership checks, bounded validation/pagination, parameterized SQL,
append-only audit/history and private PDF generation are implemented.

Readiness now verifies **all migration names and checksums**, rather than a
hardcoded two-migration count. Nginx blocks external readiness and demo/source
paths. The fictional demo is excluded from production JavaScript and login;
`npm run dev` still provides `/preview`. No production source maps are enabled.
Frontend private data remains in memory, not localStorage.

Migration hashes accept only equivalent LF/CRLF encodings across Windows/Linux;
SQL content drift still fails. Existing applied journals are not rewritten.
Fresh production storage uses the chosen Alpine runtime. Never attach an older
glibc-initialized volume to a different libc image without a reviewed logical
dump/restore and collation/index plan; the release script never replaces an
existing database container automatically.

Open acceptance items: CEO MFA is not implemented; define recovery and account
compromise procedures. Approve retention, complaint-review conflicts, company
timezone/workweek/currency, salary jurisdiction and fonts. DejaVu Sans is bundled,
but language-specific PDF glyph/layout acceptance is still required. Benchmark
Argon2, PDF generation and the global domain-write lock under representative
load. No 1,000-concurrent-user capacity guarantee is made.

## 1. Read-only infrastructure gate

Required: VM101 SSH address/user, verified host fingerprint/known_hosts, and
least-privilege read access. Never put the private key or password in this repo.
The guest's private LAN address was supplied out of band. No authorized SSH user,
usable deployment identity or verified host key was supplied. Keep that endpoint
and inventory in the private operator store, not Git.

Run **inside VM101**, not Proxmox:

```bash
bash /path/to/reviewed-checkout/deploy/scripts/preflight.sh
```

The script reads guest identity, OS, Docker/Compose, listening sockets, services,
container names/ports/projects, networks/volumes, live resource use and free disk.
It refuses a Proxmox host or unexpected guest. Review:

1. Confirm VM101 mapping from trusted infrastructure inventory, not hostname alone.
2. Inventory all existing applications and ingress owners. Do not stop/restart them.
   In particular, preserve Coolify Sentinel, Coolify networks and other applications.
3. Check project/network/volume name collisions and Docker address-pool overlap
   with routed VM/VPN networks. Do not change daemon defaults to resolve conflicts.
4. Verify compatible Compose v2 with `--wait`, cgroups/resource limits, amd64
   architecture (or rebuild/test for the actual architecture).
5. Verify spare RAM/CPU/disk, filesystem/backup permissions and offsite capacity.
6. If loopback ingress is selected, confirm `127.0.0.1:18080` is unused. Any change
   to an existing proxy, VM firewall/network, router/NAT or public port needs approval.
7. Approve the reviewed report. Keep it private at
   `/opt/ems/shared/preflight-reviewed.txt`, less than one hour old for rollout.

## 2. Files, credentials and images

Suggested guest layout, create only after production authorization:

```text
/opt/ems/releases/<40-character-commit-sha>/  reviewed source/runbooks, release.env
/opt/ems/shared/api.env                     nonsecret backend settings, mode 0600
/opt/ems/shared/deploy-policy.env            approved shell policy, mode 0600
/opt/ems/shared/recovery-reviewed.txt        private reviewed drill evidence
/opt/ems/shared/secrets/                    mode 0700, root/operator-owned
/opt/ems/shared/release.lock
/var/backups/ems/                           encrypted archives, mode 0700
```

Create a fresh secret per environment, never copy local `.env`/`.env.admin`.
Do not run `env`, unfiltered `docker inspect`, `docker compose config` (without
`--quiet`), `set -x`, or paste secret values into chat/logs.

| Secret file | Required value |
| --- | --- |
| `db_admin_password` | Unique random cluster-admin password |
| `db_owner_password` | Different random migration-owner password |
| `db_app_password` | Different random runtime password |
| `rate_limit_secret` | Stable random string, at least 32 characters |
| `readiness_secret` | Different random string, at least 32 characters |
| `mail_outbox_key` | Exactly 32 random bytes encoded as 64 hex characters |
| `resend_api_key` | Resend sending-only key scoped to approved sending domain |
| `tunnel_token` | Only for an approved dedicated Cloudflare Tunnel |

Use a password manager or approved secret manager. Generate random values directly
to protected files, not terminal output. Standalone Compose secrets are bind
mounts, not an encrypted secret store. Use readable files inside the restricted
0700 host directory (e.g. 0444 files) so the explicitly mounted non-root containers
can read them; do not make the parent directory public. Docker administrators
remain trusted. Back up encryption keys separately, encrypted and access controlled.
The API entrypoint loads `*_FILE` secrets into server process environment only;
`RESEND_API_KEY` never enters a build argument, Vite variable, frontend, or image.

Copy `deploy/api.env.example` to the protected runtime path and configure the
verified sender. Copy `deploy/.env.example` to each immutable release's
`release.env`; set actual **digest-pinned** API/web/DB images. No floating tags in
production. GHCR private pulls need `read:packages` credentials on the guest.

Build locally/CI, not on the shared production VM:

```powershell
docker build -f apps/api/Dockerfile -t ems-prep-api:20261105 .
docker build -f apps/web/Dockerfile -t ems-prep-web:20261105 .
docker build -f deploy/postgres/Dockerfile -t ems-prep-db:20261105 .
node deploy/tests/container-smoke.mjs
```

Production Docker build context uses an allowlist; secrets, mail previews, tests,
browser fixtures, generated output and `.git` are excluded. Dependencies use
`npm ci --ignore-scripts` and committed lockfile. Base image digests are pinned;
review/update and rescan them regularly.

## 3. CI/CD

`.github/workflows/ci.yml` tests web/API, TypeScript/build, API syntax, locked
dependencies, PostgreSQL 18 isolated integration on Linux, production containers,
smoke/restore/recreation, ShellCheck, actionlint, image vulnerabilities and secrets.
Scans fail on HIGH/CRITICAL image findings; no automatic exceptions.

`release.yml` is manual, main-only, requires successful CI for the exact SHA and a
protected `release` environment. It retests/scans the actual images, then publishes
commit tags to GHCR and records digests. Merely adding this file publishes nothing.
Both privileged workflows check private repository visibility, actual required
reviewers with self-review disabled, and a single `main` branch policy before the
environment job. They then verify the current run's independent approval before
publication or SSH. API denial/missing protection fails closed. Re-dispatch instead
of re-running a previous attempt, so old approval history cannot be reused.

`deploy.yml` is manual, main-only and protected by the `production` environment.
It requires `authorize-ems-vm101`, a previously staged/reviewed release SHA and a
fresh approved preflight report. Required environment secrets:
`VM101_HOST`, `VM101_USER`, `VM101_SSH_KEY`, `VM101_KNOWN_HOSTS`.
Configure required human reviewers and main-branch restrictions in both environments.
Disable administrator bypass. Required reviewers for a **private** repository
require an eligible GitHub Enterprise plan under current GitHub documentation.
Verify the account plan first; never make the repository public to obtain this
feature. No hosted deployment is allowed if the protection cannot be configured.
The user must have narrowly authorized guest deployment privileges. Docker access
is effectively root; do not install a general-purpose self-hosted runner on the
shared VM. If hosted Actions cannot reach the guest through an approved SSH path,
use the local operator command instead; do not open a firewall just for CI.

No workflow has been run on GitHub during this session. No repository push, image
publication, secret upload, branch protection or environment setting was changed.
Existing user UI work must be reviewed and included in the chosen source release;
do not discard it. See document 28 for the complete reviewed file manifest.

## 4. Private rollout and controlled bootstrap

Once infrastructure, secrets, image scans and explicit change approval are complete:

```bash
export EMS_MANIFEST=/opt/ems/releases/COMMIT_SHA/release.env
export EMS_PREFLIGHT_REPORT=/opt/ems/shared/preflight-reviewed.txt
export EMS_PROJECT=ems-prod
export EMS_INGRESS=isolated
export EMS_BACKUP_DIR=/var/backups/ems
export EMS_BACKUP_RECIPIENT=AGE_PUBLIC_RECIPIENT
export EMS_RECOVERY_REPORT=/opt/ems/shared/recovery-reviewed.txt
# Empty only for first deployment; otherwise the last healthy approved release.
export EMS_PREVIOUS_RELEASE=/opt/ems/releases/PREVIOUS_40_CHARACTER_SHA
bash /opt/ems/releases/COMMIT_SHA/deploy/scripts/release.sh deploy --approve-production
```

The script verifies namespace ownership, pins and guest, locks concurrent releases,
requires a reviewed recovery report (less than 30 days old, `result=passed`),
starts a **new EMS DB only if none exists**, pauses EMS API/worker, backs up even an
empty schema, runs explicit
migrations, grants limited runtime access and starts healthy API/web/worker.
It never recreates an existing DB container, starts a tunnel, changes DNS or changes
the public proxy. SQL 001/002 are untouched; new 003 adds the email outbox.
It preserves the approved ingress mode and refuses silent port-binding removal.
An upgrade requires a previous immutable release. A failure attempts application-only
recovery after verifying that release matches the schema **after** migrations.
If no compatible previous release exists, it stops only EMS API/web/worker,
retains the database/volumes, exits failed and requires operator recovery.
The command harness covers these branches but is not a live VM rollback drill.
Never run production `setup:local`, `--baseline` on a fresh DB, `down -v`, `prune`,
database reset, or automatic down migrations.

For first CEO bootstrap, supply the authorized CEO name/email through a temporary
protected environment file, not command-line literals or default credentials.
The file contains `BOOTSTRAP_CEO_NAME` and `BOOTSTRAP_CEO_EMAIL` only. Run:

```bash
export EMS_BOOTSTRAP_ENV=/opt/ems/shared/bootstrap.env
docker compose -p ems-prod --env-file "$EMS_MANIFEST" \
  -f /opt/ems/releases/COMMIT_SHA/deploy/compose.yaml \
  -f /opt/ems/releases/COMMIT_SHA/deploy/compose.bootstrap.yaml \
  run --rm --no-deps api scripts/bootstrap-ceo.js
```

Remove the operator-created bootstrap environment file after use. Resend queues
delivery; `pending` means queued, **not delivered**. This sends a real invitation
and therefore needs recipient authorization. CEO accepts the one-use link and
sets company policies; there is no public setup/default-password endpoint.

## 5. Public ingress

Preferred decision is **reuse approved existing HTTPS ingress**, without overwriting
its configuration. `deploy/compose.loopback.yaml` publishes only the selected unused
loopback port. Review `deploy/proxy-existing-nginx.conf.example` as a new isolated
virtual host. The ingress must overwrite `X-Real-IP`, strip client-supplied
`CF-Connecting-IP`/forwarded headers, preserve the public Host and terminate TLS.
The internal Nginx replaces forwarding headers; API trusts exactly one hop.
Do not expose internal Nginx directly to the Internet: it trusts the approved ingress.

Cloudflare alternative: `deploy/compose.tunnel.yaml` creates a **new dedicated**
connector, with no published ports. Route only `ems.ebonstudio.com` to
`http://web:8080`, HTTP Host `ems.ebonstudio.com`, with a final catch-all 404.
Enable edge HTTPS redirect, no caching of `/api/*` or account pages, no URL/body
logging, and no email-link tracking. Review connection-IP propagation before launch.
Outbound tunnel access (TCP/UDP 7844) and Resend HTTPS 443 must already be allowed
or be separately approved. Do not reuse/modify existing tunnels or containers.
Cloudflare public DNS requirements are in [DNS and Resend](27-email-and-dns.md).

After approved public routing: verify actual HTTPS certificate, mixed content,
cookie flags, CSRF/Origin, IP-specific rate limits, reset fragments/referrer policy,
unauthorized private APIs and PDFs, mobile/browser workflows, delivery, logout and
health monitoring. The old browser scripts contain stale UI selectors; historical
browser counts are not current release evidence.

## 6. Backups, restoration, rollback and monitoring

- `backup.sh` streams custom-format `pg_dump` directly to **age encryption** with
  pipefail, restrictive permissions, unique filenames and SHA-256. It never stores
  a plaintext production dump. Install age on the guest only after approval.
- Copy encrypted files offsite using an approved destination/credential. A backup
  on VM101 alone does not protect against VM/disk loss. No upload or retention
  deletion is automated without a selected destination and policy.
- Proposed daily backups / 30-day retention / RPO 24h / RTO 4h remain targets,
  not guarantees. Schedule backup and expired-record cleanup only after approval.
- Validate archives and regularly rehearse **restore into a new isolated project**:

```bash
EMS_PROJECT=ems-restore-YYYYMMDD EMS_INGRESS=isolated \
  EMS_RESTORE_ARCHIVE=/var/backups/ems/SELECTED.dump.age \
  EMS_AGE_IDENTITY=/protected/offline-key-copy \
  bash /opt/ems/releases/COMMIT_SHA/deploy/scripts/restore-drill.sh
```

The script checks checksum, refuses existing restore volumes, decrypts into
`pg_restore --single-transaction --exit-on-error`, applies idempotent grants, clears
sessions/tokens/outbox, increments session versions and checks schema. It starts
no API/worker/tunnel, sends no mail and exposes no port. Compare record counts,
constraints, attendance/leave reservations and immutable salary/audit history.
Restoring actual employee data requires approved isolation and access controls.
Moving a restored database into production or deleting any volume is a **separate
explicitly approved operation**, not an automatic part of the drill.

Code rollback: retain the previous source, immutable image digests and manifest.
Point `EMS_MANIFEST` and the invoked script to that release, then use
`release.sh rollback --approve-production`. It verifies the previous code against
the **current exact migration checksums before replacement** and does not down-migrate
or restore DB. A release before migration 003 will not match this release; use an
approved forward fix or isolated restore/cutover, never blindly revert the database.
Initial release has no historical production version to roll back to. Local tests
exercise same-schema immutable-image recreation and persistent data, not a real
historical production rollback.
The new release-failure harness also verifies nine synthetic command paths without
a Docker socket. It does not replace an actual encrypted/offsite recovery drill.

Monitor container health (Docker alone does not restart a merely unhealthy
container), HTTP error/latency, DB storage/connections, mail queue age/failures,
backup age and offsite receipt. Alert on `email_worker_unavailable` and terminal
`email_attempt` failures. Logs omit email addresses, token URLs and content.
Schedule `scripts/cleanup-expired.js` daily through the runtime API image; it
deletes expired security/mail metadata only, never employee/business history.
Keep operational dashboards/alerts private. No cron, systemd timer, monitoring
service, or notification recipient has been installed/configured on production.
