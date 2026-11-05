# EMS production handoff

Updated: **5 November 2026**. Target repository: **private `ebonstudio-ems`**.
Application: `https://ems.ebonstudio.com`.

## 1. Current readiness and safety boundary

**Ready for a reviewed local Git commit, not for production deployment.**
The existing `main` branch and initial commit `b1922bb` are preserved. This
preparation is an additional commit, not a new/replaced Git history. The existing
`origin` points to a different repository and has not been changed. Use a separate
remote named `ems` only after the owner and private destination are approved.

No repository was created, no commit/image was pushed, no production SSH command
was run, and no DNS, tunnel, VM configuration, actual database or real email was
changed. Pre-existing UI work is included intact after review. Ignored local
`.env`, `.env.admin`, private mail, backups and synthetic volumes remain local.

| Evidence | Verified result |
| --- | --- |
| Existing app checks, carried forward from this session | 199 frontend tests; 27 API tests; 51 integration results each on Windows and Alpine/Linux; typecheck/build and API syntax passed |
| Exact hardened image smoke | Argon2 login, configured PDF font, non-root PostgreSQL, routes/headers/cookies/CSRF, grants, synthetic dump/restore, session invalidation and same-schema image recreation passed |
| Trivy, database dated 2026-11-05 | API, web and DB: **0 HIGH / 0 CRITICAL**, no suppressions; immutable identities in document 25 |
| Secret scanning | All existing Git refs/history (one original commit) and all Git-visible working files: no detections |
| New publication/approval tests | 4 passed, including ignored-file boundaries and missing/invalid environment approvals |
| New release-failure harness | 9 passed: success, backup failure, migration failure, health failure, incompatible schema, first release failure, missing recovery evidence, missing previous release, unmanaged resource-name collision |
| ShellCheck / actionlint | Passed after correcting harness negative assertions |
| Dependency audit | Earlier audit: 0 advisories; no dependency/lockfile changes in this final pass |
| GitHub CI / release / deploy | **Not run remotely** |
| Actual VM, HTTPS, delivery, encrypted offsite restore | **Not verified** |

The failure harness uses mocked Docker commands in a network-disabled disposable
container with **no Docker socket**. It is not proof of a real production rollback.
Existing stale browser suites, production-shaped load, keyboard/accessibility
acceptance and language-specific PDF glyphs remain open. No 1,000-concurrent-user
capacity claim is made.

Source/doc review covered every modified and Git-visible untracked file. The
complete path manifest is at the end. Secret scans cover publishable source and
history, not the intentionally private ignored environment/mail/backup contents.
No production key, password, token or SSH private key was detected in that scope.
No private VM IP, SSH endpoint, key fingerprint, employee record or provider
account ID has been added to this handoff. Public hostnames/mail-routing records
and the user-approved VM name are operational references, not credentials.

## 2. GitHub repository setup and exact Git commands

### Local commit, preserves the original commit

The final preparation commit should include the reviewed UI refinements, backend
mail changes, infrastructure, tests and this handoff. These are the commands used
for the local commit; do not run them again just to create an empty commit.

```powershell
Set-Location -LiteralPath 'D:\PROJECT\EMPLOYE MANAGEMENT'
git status --short
node deploy/tests/secret-scan.mjs
if ($LASTEXITCODE -ne 0) { throw 'Secret scan failed; stop' }
git diff --check
if ($LASTEXITCODE -ne 0) { throw 'Diff check failed; stop' }
git add -- .gitignore .dockerignore .gitattributes .github README.md apps deploy docs
if ($LASTEXITCODE -ne 0) { throw 'Staging failed; stop' }
git diff --cached --check
git diff --cached --stat
git diff --cached
git status --short
# Review the entire staged diff and paths before this command.
git commit -m "Prepare EMS for private GitHub and production handoff" -m "Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
if ($LASTEXITCODE -ne 0) { throw 'Commit failed; do not bypass hooks or change author identity' }
git log -2 --oneline
git status --short
```

Git author identity is already configured. Never override it. No history reset,
amend of the original commit, force-push, `git clean`, or blanket file deletion is
needed. If a later secret is detected, stop publication, identify the file/line
without printing the value, revoke/rotate the credential, and arrange an approved
history-remediation plan if it was committed. Do not rewrite history automatically.

### External setup, only after separate creation/push approval

**Owner/organization is still unspecified.** GitHub CLI is not installed locally.
Install/authenticate an approved CLI yourself or use the GitHub UI; do not paste
tokens into chat. The following single CLI procedure assumes `gh` is installed
and authenticated through its browser/credential-store flow:

```powershell
Set-Location -LiteralPath 'D:\PROJECT\EMPLOYE MANAGEMENT'
$Owner = 'REPLACE_WITH_APPROVED_OWNER'
if ($Owner -eq 'REPLACE_WITH_APPROVED_OWNER') { throw 'Owner required' }
$Repo = "$Owner/ebonstudio-ems"
# CREATION APPROVAL REQUIRED. No --push and no automatic README/license.
gh repo create $Repo --private
if ($LASTEXITCODE -ne 0) { throw 'Creation failed or repository exists; inspect, never overwrite' }
$Private = gh repo view $Repo --json isPrivate --jq '.isPrivate'
if ($LASTEXITCODE -ne 0 -or $Private -ne 'true') { throw 'Private repository verification failed' }
if ((git remote) -contains 'ems') { throw 'ems remote exists; review it without overwriting' }
git remote add ems "https://github.com/$Repo.git"
if ($LASTEXITCODE -ne 0) { throw 'Remote setup failed' }
$RemoteRefs = @(git ls-remote ems)
if ($LASTEXITCODE -ne 0) { throw 'Cannot verify target access' }
if ($RemoteRefs.Count -ne 0) { throw 'Target has history; stop and review, do not force-push' }
# PUSH APPROVAL REQUIRED, distinct from creation approval.
git push --set-upstream ems main
if ($LASTEXITCODE -ne 0) { throw 'Push failed; never force-push' }
```

If the repository already exists, do not run creation or overwrite its history.
Verify its owner, privacy, contents and access with the owner first. Never use bare
`git push` or push to the old `origin` during this setup. Do not publish a public
repository as a workaround for plan restrictions.

After the approved first push:

1. Confirm default branch `main` and repository visibility **Private**.
2. Protect `main`: require PR review and the `verify` CI job, disallow force pushes
   and branch deletion, restrict bypass, and require review of workflow changes.
   Select the actual status-check name shown by the first CI run.
3. Create `release` and `production` environments. Configure required trusted
   reviewers, **prevent self-review**, disable administrator bypass, and select
   exactly one deployment branch policy: branch `main`, no tags/wildcards.
4. **Plan gate:** current GitHub docs limit required reviewers on private
   repositories to eligible Enterprise plans. Verify this feature is available.
   Free/Pro/Team must not be assumed sufficient. If unavailable, leave automated
   publication/deployment blocked; do not weaken protection or make source public.
5. Set default Actions token permissions to read-only. Allow only reviewed,
   SHA-pinned actions. Store deployment secrets at environment scope only.
6. Confirm all GHCR packages remain private and the guest has pull-only access.
   Validate CI on the exact commit before manually requesting image publication.

Reference: https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments

## 3. CI/CD behavior and approval enforcement

| Workflow | Trigger / permissions | Behavior |
| --- | --- | --- |
| `ci.yml` | main push, PR, manual; `contents: read` | Full-history and current-file secret scan before install, publication/approval tests, `npm ci --ignore-scripts`, frontend/API tests, API syntax, TS/Vite build, npm audit, isolated PG18 integration/migrations, recovery-command tests, production image build/smoke, ShellCheck/actionlint and Trivy HIGH/CRITICAL gate |
| `release.yml` | manual main only, `publish-tested-images`; protected `release` | Requires exact-commit successful main CI; rebuilds/smoke-tests/scans actual images; publishes commit-SHA tags to private GHCR and records content digests; `packages: write` only in this job |
| `deploy.yml` | manual main only, `authorize-ems-vm101`; protected `production` | Requires approved 40-hex pre-staged release SHA and successful main CI; strict-host-key SSH; invokes reviewed guest release/rollback script; no source upload, DNS, proxy edit or firewall action |

Both privileged workflows independently query GitHub before the environment job:
private repository, configured required reviewers, self-review prevention, and
main-only branch policy are mandatory. Before privileged work they verify an
actual independent approval recorded for that run. Missing protection, API 403,
or absent approval fails closed. These controls complement GitHub's actual
environment rules; merely declaring `environment: production` is insufficient.

Use a **fresh workflow dispatch**, not “Re-run jobs”; old attempt approvals are
deliberately rejected. No CI workflow receives production application secrets.
No `pull_request_target` or untrusted PR execution with production credentials.
Checkout does not persist Git credentials; publication uses `--password-stdin`.
SSH key/known-host files have private permissions and are removed on step exit.
Never enable shell tracing or print environment/Compose configuration values.

No separate JS lint/formatter command is configured. CI runs the configured
syntax/type/build checks, whitespace checks, ShellCheck and actionlint rather
than inventing a formatter or claiming an unconfigured lint passed.

Commit tags identify source but can be retagged by a registry operator. Deployment
therefore requires **`@sha256:` image references**, not just SHA tags. Package
digests from the approved release summary populate the guest `release.env`.

## 4. Required GitHub secrets and guest configuration

### GitHub `production` environment secrets

| Name | Purpose |
| --- | --- |
| `VM101_HOST` | Approved reachable guest SSH endpoint, kept out of Git; the supplied LAN IP alone is not reachable by a standard hosted runner |
| `VM101_USER` | Authorized guest deployment account; no automatic account creation |
| `VM101_SSH_KEY` | Dedicated private deployment key; load via GitHub's secret UI/approved secret manager |
| `VM101_KNOWN_HOSTS` | Verified host-key entry obtained through a trusted channel; never trust unverified `ssh-keyscan` output |

SSH currently uses port 22. A nondefault port requires a reviewed workflow change.
There is no deployment runner on the shared VM. Do not expose SSH to the Internet
or install a privileged self-hosted runner merely to make Actions reach it.
Without an already-approved route, deployment remains an explicitly authorized
operator-run procedure.

`GITHUB_TOKEN` is automatic, not a manually stored PAT: read-only CI; Actions read
for checks; package write only for approved publication. A separate guest
pull-only GHCR credential belongs in its approved credential store, not source.
No Resend key, DB password, SMTP password, tunnel token, outbox key or age recovery
identity belongs in GitHub CI. The age private identity stays offline/protected.

### Complete production template set

- `deploy/.env.example`: nonsecret release manifest, copied as `release.env`.
- `deploy/api.env.example`: backend settings and documented Compose-fixed values.
- `deploy/deploy-policy.env.example`: approved shell policy for SSH deployment.
- `deploy/compose.yaml`: authoritative fixed values and secret-file mappings.
- `apps/api/.env.example`: **local development only**, never copy local credentials.

| Variables / files | Production value or rule |
| --- | --- |
| `EMS_RUNTIME_DIR` | `/opt/ems/shared` |
| `EMS_API_IMAGE`, `EMS_WEB_IMAGE`, `EMS_DB_IMAGE` | Approved private GHCR image **digests** |
| `EMS_HTTP_PORT` | Verified unused loopback port, proposed 18080; unused in isolated mode |
| `EMS_TUNNEL_IMAGE` | Required verified digest only for a separately approved tunnel |
| `NODE_ENV`, `HOST`, `PORT` | `production`, `0.0.0.0`, `3000` inside container; no published API port |
| `APP_ORIGIN`, `TRUST_PROXY_HOPS` | `https://ems.ebonstudio.com`, `1`; ingress must sanitize forwarding headers |
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` | `db`, `5432`, `ems`, `ems_app`; migrator uses `ems_owner` |
| `PGSSLMODE` | `disable` only on the isolated in-VM bridge; off-host DB requires verified TLS |
| `POSTGRES_USER`, `POSTGRES_DB`, `PGDATA` | `ems_admin`, `ems`, `/var/lib/postgresql/18/docker` |
| `POSTGRES_INITDB_ARGS` | SCRAM host/local authentication, already in Compose |
| `PDF_FONT_PATH` | `/opt/ems-fonts/DejaVuSans.ttf`; approve actual language coverage |
| `MAIL_MODE` | `resend`; production worker is not compatible with SMTP mode |
| `MAIL_FROM_DOMAIN`, `MAIL_FROM` | Verified approved domain/sender; proposed notify subdomain is not yet verified |
| `HR_NOTIFICATIONS_ENABLED` | `false` until notification-policy approval |
| `ENABLED_MODULES` | `holidays,attendance,leave,tasks,complaints,salary-slips`; attendance/leave require holidays |
| `EMS_PROJECT`, `EMS_INGRESS` | `ems-prod`; initially `isolated`, then preserve separately approved mode |
| `EMS_BACKUP_DIR`, `EMS_BACKUP_RECIPIENT` | Approved absolute private directory and public age recipient |
| `EMS_PREFLIGHT_REPORT` | Reviewed private inventory less than one hour old |
| `EMS_RECOVERY_REPORT` | Reviewed recovery evidence less than 30 days old containing `result=passed` |
| `EMS_PREVIOUS_RELEASE` | Last healthy `/opt/ems/releases/<40-hex-SHA>`; empty only on initial deployment |

Secret files below live only in `/opt/ems/shared/secrets`, parent mode `0700`.
Compose mounts only explicitly needed files; the entrypoint loads them into
backend process environment. Do not set both a direct variable and its `_FILE`.

| Secret file | Environment mapping / value |
| --- | --- |
| `db_admin_password` | `POSTGRES_PASSWORD_FILE`; unique random admin credential |
| `db_owner_password` | Migrator `PGPASSWORD_FILE`; different random owner credential |
| `db_app_password` | API/worker `PGPASSWORD_FILE`; different random runtime credential |
| `rate_limit_secret` | `RATE_LIMIT_SECRET_FILE`; stable random value, >=32 characters |
| `readiness_secret` | `READINESS_SECRET_FILE`; independent random value, >=32 characters |
| `mail_outbox_key` | `MAIL_OUTBOX_KEY_FILE`; exactly 32 random bytes encoded as 64 hex |
| `resend_api_key` | `RESEND_API_KEY_FILE`; sending-only, verified-domain-scoped Resend key |
| `tunnel_token` | Optional connector-only token file, never mounted into API/web |

Generate unique secrets per environment directly into an approved secret store.
For an **approved new empty secret directory**, this guest-side example writes
only random app/DB secrets, never prints them, and refuses overwrites:

```bash
umask 077
set -o noclobber
for name in db_admin_password db_owner_password db_app_password rate_limit_secret readiness_secret mail_outbox_key; do
  openssl rand -hex 32 > "/opt/ems/shared/secrets/$name" || exit 1
  chmod 0444 "/opt/ems/shared/secrets/$name"
done
```

Provider keys are imported through the approved secret manager, not generated or
pasted into shell commands/chat. Compose secrets are protected bind mounts, not
an encrypted vault; trusted Docker administrators can read them. Keep parent
directories private and back up keys separately under encryption.

No JWT signing key is applicable: sessions are random opaque values, hashed in
PostgreSQL. Production cookies are Secure/HttpOnly/SameSite=Lax, host-only, with
30-minute idle / 8-hour absolute expiry. Same-origin `/api/v1` avoids cross-origin
CORS; no wildcard origin and no secret-bearing `VITE_*` setting is needed.

## 5. VM101 requirements and safe deployment commands

Target: Debian 13 guest `products`, VM101 on Proxmox. Preserve Coolify Sentinel,
existing containers/networks/volumes, application directories and ingress. The
private endpoint is in the operator inventory, not this repository.

**Access blocker:** no approved SSH user/key/verified host key or hosted-runner
route has been supplied. No authentication bypass or account creation attempted.
The SSH client being installed does not constitute authorized access.

Before any change, an authorized operator runs inside the guest:

```bash
bash /path/to/reviewed-checkout/deploy/scripts/preflight.sh
```

Review guest mapping, existing applications including Coolify, Docker networks and
address-pool overlaps, mounts/data ownership, listeners/proxy owners, disk growth,
memory/CPU headroom, Compose `--wait` support and architecture. Inventory directory
names and proxy routes without dumping secrets. Verify whether any existing
PostgreSQL belongs to another application; **do not use it for EMS**. Keep the
inventory private and approve `/opt/ems/shared/preflight-reviewed.txt`.

Dedicated EMS layout/resources:

- `/opt/ems/releases/<SHA>` immutable reviewed source plus `release.env`.
- `/opt/ems/shared` private settings, policy, secrets, reports and release lock.
- Compose project `ems-prod`; dedicated labelled internal DB/application networks.
- Dedicated PostgreSQL container, `ems` database, roles and `ems-prod_pgdata`.
- No published DB/API ports; optional new loopback web binding only after approval.
- Explicit restart, resource, PID, logging and security settings in Compose.
- Fresh Alpine PostgreSQL storage only; no older glibc/other-major volume reuse.
- At least 4 GiB spare memory plus measured CPU/disk headroom, not assumed from VM totals.

The operator must first verify an encrypted restore/offsite procedure in an
approved isolated environment, including the recovery identity, record/invariant
checks and duration. A reviewer records the evidence path, archive hash, storage
receipt, timestamp and `result=passed` in `recovery-reviewed.txt`. The marker is an
operator attestation, **not automatic proof**; never fabricate it to bypass a gate.

After separate VM, deployment and migration approvals, pre-stage the exact source,
private digest-pinned images, secrets and policy. Confirm the staged tree matches
the approved SHA and is clean. Do not build on the shared VM. No workflow uploads
source or silently provisions these paths.

```bash
# GUEST ONLY, AFTER APPROVAL. Replace with the reviewed 40-hex commit.
RELEASE=REPLACE_WITH_APPROVED_40_HEX_SHA
[[ "$RELEASE" =~ ^[a-f0-9]{40}$ ]] || exit 1
set -a
. /opt/ems/shared/deploy-policy.env
set +a
export EMS_MANIFEST="/opt/ems/releases/$RELEASE/release.env"
export EMS_PREFLIGHT_REPORT=/opt/ems/shared/preflight-reviewed.txt
bash "/opt/ems/releases/$RELEASE/deploy/scripts/release.sh" deploy --approve-production
```

The script checks guest/namespace/digests, locks releases, requires recovery
evidence, starts only a new EMS DB when none exists, pauses EMS API/worker, makes
an encrypted backup **before every migration**, migrates with the owner role,
then starts and health-checks API/web/worker plus internal proxy routes.
It never recreates an existing database or starts the optional tunnel. Preserve
the approved ingress mode in policy; a deployment is not permission to change it.

Initial bootstrap requires an approved recipient and a private temporary
`bootstrap.env` containing only `BOOTSTRAP_CEO_NAME` / `BOOTSTRAP_CEO_EMAIL`:

```bash
export EMS_BOOTSTRAP_ENV=/opt/ems/shared/bootstrap.env
docker compose -p ems-prod --env-file "$EMS_MANIFEST" \
  -f "/opt/ems/releases/$RELEASE/deploy/compose.yaml" \
  -f "/opt/ems/releases/$RELEASE/deploy/compose.bootstrap.yaml" \
  run --rm --no-deps api scripts/bootstrap-ceo.js
```

This queues a **real invitation** and needs separate email approval. Remove only
that operator-created temporary file afterward. No default account/password exists.

Never run shared `down -v`, prune, volume/database deletion, `setup:local`,
data-directory reinitialization, automatic down migrations, or host-wide changes.

## 6. Cloudflare, authoritative DNS and HTTPS

Read-only observations on 5 November 2026:

- NS: `ns47.domaincontrol.com`, `ns48.domaincontrol.com`, **GoDaddy authoritative**.
- Root MX: priority `0`, `receive-apne1.forge.rmta.net`; preserve exactly.
- Root DMARC: `p=quarantine`; preserve the complete policy/reporting configuration.
- Application hostname A lookup: NXDOMAIN.
- Cloudflare connector connected; exact-name zone lookup returned **zero accessible
  `ebonstudio.com` zones**. Account/permissions may be wrong; global absence is not proven.
- No DNS/tunnel/nameserver changes. No tunnel API is exposed by the connected tools.

Chosen default approach is to keep GoDaddy authoritative and reuse an **approved
existing HTTPS ingress** after inventory. Exact external target remains blocked:

| Proposed addition | Value required before approval |
| --- | --- |
| `A ems` | Verified public ingress IPv4, **not the VM's private address** |
| `AAAA ems` | None unless IPv6 routing/TLS is separately verified |
| Certificate validation | Provider-issued exact challenge record, if the existing certificate process requires it |

If the ingress owner requires a CNAME instead, replace the proposed A plan with
that exact approved target; never add competing CNAME/A records. No DNS write is
authorized by this document.

For a separately approved Cloudflare Tunnel, traffic would flow:
browser HTTPS -> Cloudflare edge -> outbound dedicated `cloudflared` connector ->
`http://web:8080` on the EMS ingress network -> internal API on `api:3000`.
No host ports are needed. In the tunnel dashboard configure only:

```yaml
ingress:
  - hostname: ems.ebonstudio.com
    service: http://web:8080
    originRequest:
      httpHostHeader: ems.ebonstudio.com
  - service: http_status:404
```

`compose.tunnel.yaml` is a token-managed connector; configure the rules in the
approved Cloudflare account, not by assuming this YAML is loaded automatically.
Set the exact approved connector image digest and secret token. Outbound 7844
and HTTPS 443 must be compatible with the existing network policy.

Zone ownership/plan and edge certificate support must be verified first. A plain
GoDaddy CNAME to an invented tunnel UUID is not sufficient. Keeping GoDaddy
authoritative requires eligible partial/delegated onboarding with provider-issued
records. **Do not change nameservers.** A supported managed-zone tunnel normally
uses the actual `<TUNNEL_UUID>.cfargotunnel.com` target; no UUID/validation value
is available here, so exact tunnel DNS remains blocked.

Approved ingress must overwrite client-IP headers and preserve public Host.
Do not cache API/account pages or log URL/body/security-link data. HTTPS, real
cookie/CSRF behavior, forwarded IP/rate limits and cert renewal remain live checks.

## 7. Resend configuration and exact DNS blocker

Use official backend Resend HTTPS API, not frontend code. Suggested sender:
`Ebon Studio EMS <no-reply@notify.ebonstudio.com>`, **not yet approved/verified**.

Resend/GoDaddy are not offered connectors in this organization. Obtain the
nonsecret domain-DNS export from the authenticated Resend dashboard and a current
GoDaddy zone export through the account owner. No API key is requested in chat.

| Required dashboard data | Status |
| --- | --- |
| Verified sending domain, region, sender | Missing |
| Exact DKIM hostname, type and public value | Missing, do not invent |
| Exact return-path SPF hostname/value | Missing, do not invent or duplicate SPF |
| Exact bounce MX hostname, target and priority | Missing, do not guess regional values |
| Existing SPF/DKIM/MX/DMARC/CAA inventory | Public observations only; account export required |
| Sending-only key and approved test recipient | Not provisioned/authorized |

Preserve root MX and existing SPF/DKIM/DMARC. Do not add bounce MX at `@`, enable
company-domain receiving, or weaken quarantine with a subdomain `p=none`.
Provider-specific additions require approval of the exact names/values first.

Verified locally: queue transactionality, encrypted payloads, bounded retries,
idempotency, stale-token cancellation, generic notification content and safe logs.
**Not verified:** real API acceptance, inbox delivery, bounce handling or
SPF/DKIM/DMARC Authentication-Results. SMTP is a legacy alternative in source;
this deployment uses Resend and does not claim SMTP verification.
Delivery/bounce webhooks are not implemented; monitor the Resend dashboard.

Keep HR notifications disabled until business approval. One authorized test
recipient must demonstrate invitations, recovery, approved generic notifications,
provider errors and delivery authentication before inviting employees.

## 8. Backup, restore, migration and rollback

### Backup policy and commands

Proposed, not configured: daily encrypted custom-format PostgreSQL backups,
30-day retention, RPO 24 hours / RTO 4 hours. The owner must approve retention,
offsite destination, storage jurisdiction/access, recovery ownership and monitoring.
No automatic retention deletion or offsite upload is installed.

`/var/backups/ems` is the proposed private guest staging location. It alone does
not protect against VM loss. Archive and checksum must be copied to the approved
independent storage destination and receipt verified. The exact upload command is
**blocked until the destination and approved tool/credentials are selected**.

```bash
# After approved policy/manifest are loaded as in section 5:
bash "/opt/ems/releases/$RELEASE/deploy/scripts/backup.sh"
# Select the actual returned encrypted archive, not a guessed latest filename:
ARCHIVE=/var/backups/ems/REPLACE_WITH_SELECTED.dump.age
sha256sum --check "$ARCHIVE.sha256"
```

`backup.sh` uses pipefail and streams `pg_dump` directly through age encryption,
never to plaintext disk. Unique private filenames and `.partial` prevent a failed
dump from being presented as a completed backup. A hash verifies integrity, not
decryptability or restorability. Local `age` CLI is absent; the actual encrypted
round trip and offsite restore are still unverified. Install tools on the guest
only after authorization.

### Restore only into a new isolated project

Run only with approved data access and an unused restore project name. Use the
matching reviewed schema/image manifest, and a protected offline-key copy:

```bash
export EMS_PROJECT=ems-restore-REPLACE_WITH_UNIQUE_LOWERCASE_ID
export EMS_INGRESS=isolated
export EMS_RESTORE_ARCHIVE="$ARCHIVE"
export EMS_AGE_IDENTITY=/protected/approved-age-identity
bash "/opt/ems/releases/$RELEASE/deploy/scripts/restore-drill.sh"
```

Use lowercase letters, digits and hyphens for the unique suffix. The script refuses
existing target volumes, checks the encrypted archive hash, restores in one
transaction, checks migrations/grants, clears sessions/tokens/outbox, and bumps
session versions. It starts no web/worker/tunnel and sends no mail.
Verify aggregate counts, audit/salary immutability, attendance/leave invariants,
schema version and elapsed recovery time without printing employee data.

After inspection, stop only that specific restore project's DB if authorized:

```bash
docker compose -p "$EMS_PROJECT" --env-file "$EMS_MANIFEST" \
  -f "/opt/ems/releases/$RELEASE/deploy/compose.yaml" stop db
```

No volume deletion. Actual data cutover is a separate reviewed change. Restore
security state must never resurrect sessions or send queued historical emails.

### Migrations and application rollback

001/002 SQL are unchanged; 003 adds the outbox. LF/CRLF-equivalent checksums are
accepted; SQL content changes still fail. Backups and reviewed recovery evidence
are mandatory before production migrations. Do not use a migration down-script
or attach an old glibc volume directly to the new Alpine runtime.

Before every upgrade, policy must identify the last healthy immutable source,
manifest and image digests through `EMS_PREVIOUS_RELEASE`. Retain those images on
the guest. Automated failure handling:

1. If backup, migration, application start or internal health fails after the
   application is paused/changed, check the previous code against the **current**
   migration journal.
2. If identical schema, recreate only API/web/worker with the previous manifest
   and verify internal health. Keep the deployment job failed for operator review.
3. If schema changed, the previous image is missing, or recovery health fails,
   stop only EMS API/web/worker, retain DB/volumes, and require an approved forward
   fix or isolated restore/cutover. Never restore data automatically.
4. First release has no previous production application. A failed first rollout
   retains its DB and stops application services; no historical rollback is claimed.

Explicit code rollback, after approval and a fresh inventory:

```bash
PREVIOUS=REPLACE_WITH_PREVIOUS_HEALTHY_40_HEX_SHA
[[ "$PREVIOUS" =~ ^[a-f0-9]{40}$ ]] || exit 1
export EMS_PROJECT=ems-prod
export EMS_MANIFEST="/opt/ems/releases/$PREVIOUS/release.env"
# Keep the approved ingress, backup policy and evidence loaded.
# For failure recovery, EMS_PREVIOUS_RELEASE identifies the currently healthy release.
bash "/opt/ems/releases/$PREVIOUS/deploy/scripts/release.sh" rollback --approve-production
```

Schema compatibility is verified before replacement. A pre-003 release cannot
roll back an after-003 database under this exact-schema policy.

## 9. Final launch checklist

All unchecked items remain required; local tests are not production acceptance.

- [x] Source/change review, ignore-rule regression and all-ref/current secret scans.
- [x] Local app tests, hardened image scans and synthetic recovery/container checks.
- [x] Approval-policy tests, deployment-failure command tests, shell/workflow lint.
- [ ] Private GitHub owner/destination approved; repository created and push authorized.
- [ ] Remote CI passed on the release SHA; protected branch/environments verified.
- [ ] Private GHCR publication approved; actual release digests rescanned and retained.
- [ ] Authorized VM101 access, existing Coolify/workload inventory and spare capacity.
- [ ] Protected runtime secrets, correct sender/origin, approved ingress configuration.
- [ ] Usable encrypted backup, offsite receipt and restore/cutover rehearsal.
- [ ] Current preflight/recovery reports and rollback/previous-image availability.
- [ ] Domain/HTTPS/certificate renewal and IP propagation verified.
- [ ] CEO invitation/login, reset, logout, idle/absolute expiry and CSRF verified live.
- [ ] Employee create/update/deactivate/reinvite and employee-scope access verified live.
- [ ] Attendance check-in/out, timezone, corrections, leave conflicts verified live.
- [ ] Salary draft privacy, publication/void history and private PDF/language acceptance.
- [ ] Resend test-recipient delivery, Authentication-Results and bounce procedure.
- [ ] CEO/employee authorization and cross-account denial across private APIs/PDFs.
- [ ] Actual browser/mobile/keyboard accessibility and representative load acceptance.
- [ ] Readiness, proxy health, logs, resource/queue metrics and alert recipients.
- [ ] Daily backup/cleanup scheduling and approved retention in place.
- [ ] Explicit final launch and real-employee invitation approvals.

Authorized post-routing probes can use the public liveness URL and login page;
private readiness must remain 404. Do not expose the readiness secret:

```bash
curl --fail --silent --show-error https://ems.ebonstudio.com/api/v1/health/live
curl --fail --silent --show-error --output /dev/null https://ems.ebonstudio.com/login
test "$(curl --silent --output /dev/null --write-out '%{http_code}' https://ems.ebonstudio.com/api/v1/health/ready)" = 404
```

Monitor HTTP latency/errors, container health (unhealthy alone does not cause
Docker restart), disk/DB connections, worker heartbeat/queue age, terminal email
failures, backup age and offsite receipts. Existing logs intentionally omit
credentials, recipients, request bodies and tokens. Review only scoped service
logs in private; do not dump container environments. No monitoring recipient,
scheduled cleanup or backup timer has been configured in production.

## 10. Blockers, approval boundaries and exact next action

**BLOCKED**
- GitHub owner/access and private-repository required-reviewer plan not confirmed;
  GitHub CLI unavailable locally; no remote workflow run or protected environment
  has been verified.
- No authorized VM SSH identity/host key or approved Actions-to-private-VM route.
- No read-only VM capacity, Coolify/proxy/port/directory/volume inventory yet.
- No verified public ingress address or usable matching Cloudflare zone/tunnel.
- Missing Resend domain/DNS export, sending key and approved recipient.
- Missing approved guest secrets, offsite destination/retention and usable encrypted
  recovery proof; `age` is not installed locally.
- Live HTTPS/business/browser/load/PDF/email/monitoring/rollback acceptance remains.

**APPROVAL REQUIRED**
- Create private `<OWNER>/ebonstudio-ems`; separately approve first push.
- Publish private registry images through the protected release environment.
- Any VM provisioning, ingress/Cloudflare/DNS change, deployment or migration.
- Any real email, actual-data recovery/cutover, retention deletion or public launch.
- Nameserver changes are not part of this plan.

**Exact next action from the owner:** provide the GitHub owner/organization name
and confirm its private-environment reviewer capability, then explicitly approve
creation of **private `<OWNER>/ebonstudio-ems`**. Approve the first push separately
after the local commit and target privacy are reviewed. Do not send any secret in
chat. VM access and provider secrets should later be supplied through approved
secret stores, not by weakening authentication.

Detailed supporting procedures: [deployment](26-production-deployment.md),
[DNS/email](27-email-and-dns.md), [evidence](25-production-execution-log.md).

## 11. Complete preparation file manifest

Relative to original commit `b1922bb`. `M` means modified tracked file; `A` means
new source file. Includes preserved user UI work, not just changes authored during
production preparation. Ignored private/generated files are intentionally absent.

114 files: 55 modified, 59 added.

- M `.gitignore`
- M `README.md`
- M `apps/api/.env.example`
- M `apps/api/scripts/bootstrap-ceo.js`
- M `apps/api/scripts/cleanup-expired.js`
- M `apps/api/scripts/grant-runtime.js`
- M `apps/api/scripts/migrate.js`
- M `apps/api/src/app.js`
- M `apps/api/src/core/config.js`
- M `apps/api/src/core/transactions.js`
- M `apps/api/src/modules/employees/routes.js`
- M `apps/api/src/modules/identity/mail.js`
- M `apps/api/src/modules/identity/routes.js`
- M `apps/api/src/modules/identity/service.js`
- M `apps/api/src/server.js`
- M `apps/api/tests/integration/local-setup.test.js`
- M `apps/web/src/App.tsx`
- M `apps/web/src/components/AttendanceClock.test.tsx`
- M `apps/web/src/components/AttendanceClock.tsx`
- M `apps/web/src/components/AuthStory.tsx`
- M `apps/web/src/components/Brand.test.tsx`
- M `apps/web/src/components/Layout.tsx`
- M `apps/web/src/components/TitleCopy.test.tsx`
- M `apps/web/src/components/ui.tsx`
- M `apps/web/src/core/modules.ts`
- M `apps/web/src/core/store.tsx`
- M `apps/web/src/live/App.tsx`
- M `apps/web/src/live/Attendance.tsx`
- M `apps/web/src/live/AttendanceClockControl.tsx`
- M `apps/web/src/live/Auth.tsx`
- M `apps/web/src/live/Complaints.tsx`
- M `apps/web/src/live/Dashboard.test.tsx`
- M `apps/web/src/live/Dashboard.tsx`
- M `apps/web/src/live/Employees.tsx`
- M `apps/web/src/live/Holidays.tsx`
- M `apps/web/src/live/Leave.tsx`
- M `apps/web/src/live/Salary.tsx`
- M `apps/web/src/live/Tasks.tsx`
- M `apps/web/src/live/components.tsx`
- M `apps/web/src/modules/attendance/Attendance.tsx`
- M `apps/web/src/modules/attendance/AttendanceClockControl.tsx`
- M `apps/web/src/modules/complaints/Complaints.tsx`
- M `apps/web/src/modules/dashboard/Dashboard.tsx`
- M `apps/web/src/modules/employees/Employees.tsx`
- M `apps/web/src/modules/holidays/Holidays.tsx`
- M `apps/web/src/modules/leave/Leave.tsx`
- M `apps/web/src/modules/salary/Salary.tsx`
- M `apps/web/src/modules/settings/Audit.tsx`
- M `apps/web/src/modules/tasks/Tasks.tsx`
- M `apps/web/src/styles.css`
- M `apps/web/tests/leave-cancel.browser.js`
- M `apps/web/tests/polish-fixture.mjs`
- M `apps/web/tests/studio-styles.test.js`
- M `apps/web/tsconfig.json`
- M `docs/10-deployment-and-operations.md`
- A `.dockerignore`
- A `.gitattributes`
- A `.github/workflows/ci.yml`
- A `.github/workflows/deploy.yml`
- A `.github/workflows/release.yml`
- A `apps/api/Dockerfile`
- A `apps/api/migrations/003_email_outbox.sql`
- A `apps/api/scripts/check-schema.js`
- A `apps/api/scripts/deploy-migrate.js`
- A `apps/api/scripts/healthcheck.js`
- A `apps/api/scripts/mail-worker.js`
- A `apps/api/src/core/migration-checksum.js`
- A `apps/api/src/core/schema.js`
- A `apps/api/src/core/secrets.js`
- A `apps/api/src/modules/identity/outbox.js`
- A `apps/api/src/modules/identity/resend.js`
- A `apps/api/tests/integration/outbox.test.js`
- A `apps/api/tests/migration-checksum.test.js`
- A `apps/api/tests/resend.test.js`
- A `apps/web/Dockerfile`
- A `apps/web/src/PreviewApp.tsx`
- A `apps/web/src/components/DashboardSections.test.tsx`
- A `apps/web/src/components/DashboardSections.tsx`
- A `apps/web/src/core/demo-context.ts`
- A `apps/web/src/modules/dashboard/Dashboard.test.tsx`
- A `apps/web/tests/refinement-fixtures.js`
- A `apps/web/tests/refinement-frame.html`
- A `apps/web/tests/refinement-review.browser.js`
- A `apps/web/tests/refinement-review.html`
- A `deploy/.env.example`
- A `deploy/api.env.example`
- A `deploy/compose.bootstrap.yaml`
- A `deploy/compose.loopback.yaml`
- A `deploy/compose.tunnel.yaml`
- A `deploy/compose.yaml`
- A `deploy/deploy-policy.env.example`
- A `deploy/docker-entrypoint.sh`
- A `deploy/nginx/nginx.conf`
- A `deploy/postgres/10-ems-roles.sh`
- A `deploy/postgres/Dockerfile`
- A `deploy/proxy-existing-nginx.conf.example`
- A `deploy/scripts/backup.sh`
- A `deploy/scripts/common.sh`
- A `deploy/scripts/preflight.sh`
- A `deploy/scripts/release.sh`
- A `deploy/scripts/restore-drill.sh`
- A `deploy/tests/Dockerfile`
- A `deploy/tests/Dockerfile.dockerignore`
- A `deploy/tests/container-smoke.mjs`
- A `deploy/tests/github-approval.mjs`
- A `deploy/tests/github-approval.test.mjs`
- A `deploy/tests/publication.test.mjs`
- A `deploy/tests/release-safety.test.sh`
- A `deploy/tests/secret-scan.mjs`
- A `docs/24-dashboard-refinement.md`
- A `docs/25-production-execution-log.md`
- A `docs/26-production-deployment.md`
- A `docs/27-email-and-dns.md`
- A `docs/28-production-handoff.md`
