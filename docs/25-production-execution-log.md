# Production preparation execution log

## Scope and safety

Target: Debian 13 guest `products`, Proxmox VM 101, `https://ems.ebonstudio.com`.
This log records local preparation only. No production deployment, DNS change,
Proxmox change, real email, or production database operation has been performed.
Existing uncommitted frontend refinements are user work and are preserved.
Never put credentials, employee records, invitation links, or environment dumps here.

## 2026-11-05

1. Inventoried the repository and checked for repository/ancestor instructions (none found).
2. Identified npm workspaces: React 19 / TypeScript / Vite frontend, Express 5 /
   JavaScript ESM API, PostgreSQL 18. No existing Dockerfiles, Compose or GitHub workflows.
3. Inspected identity, authorization, sessions, CSRF, SQL migrations, runtime grants,
   employee/company operations and operations documentation. Requested independent
   read-only frontend and remaining domain-module security reviews.
4. Confirmed local Node 24.19.0, npm 11.17.0, Docker Engine 29.7.2,
   Compose 5.4.0, Linux/x86_64 Docker Desktop and installed PostgreSQL 18 test binaries.
   Local Docker has existing images but no running containers. Existing images will
   not be removed or overwritten.
5. Baseline passed: 199 frontend tests, 14 API unit tests, 44 PostgreSQL integration
   results (including parents). `npm audit` reported zero advisories.
6. Added the user's Resend requirement. Existing mail supports invitations,
   password resets and CEO invitations via disabled, private preview or SMTP modes.
   Existing delivery has no durable retry worker or HR notifications.
7. Read official Resend send-email, idempotency and domain documentation and
   Cloudflare Tunnel DNS documentation. Connector discovery failed with ECONNRESET;
   no account access or provider-specific DNS values are available.
8. Completed source review: 104 frontend/config/test/public-text files and all API
   source/scripts/migrations/tests, with an independent 21-file backend domain
   review. No additional high-confidence exploitable frontend/domain finding was
   established. Confirmed production preview exposure and stale browser selectors.
9. Implemented official Resend REST transport, authenticated encrypted outbox,
   migration 003, stable idempotency, row leasing, bounded retries, generic HR
   templates, safe logs, worker health and cleanup. Added regression tests.
10. Updated readiness/startup to check every migration checksum. Added secret-file
    loading, request timeouts and production-only frontend exclusion of demo code.
    Existing user UI refinements were preserved.
11. Passed 26 API unit tests, 51 Windows PostgreSQL integration results, then
    **51 Linux PostgreSQL integration results** in an isolated network-disabled
    container. Passed frontend 199 tests, TypeScript/production build and API syntax.
12. Prepared pinned non-root API/web images, dedicated PostgreSQL image/roles,
    isolated Compose, ingress overlays, backup/restore/release scripts, gated CI,
    image publication and SSH deployment workflows, deployment and DNS runbooks.
13. Initial database image build succeeded into builder cache but did not load a
    runnable tag. Container smoke correctly failed instead of silently pulling a
    substitute. Rebuilt with explicit `--load`; image loaded successfully.
14. Linux integration image initially failed because Docker Hub DNS/downloads
    failed. Retry using cached layers succeeded, with all 51 tests passing.
15. Container startup found a real Nginx read-only-filesystem issue: default FastCGI
    temporary paths. Moved all Nginx temporary paths into bounded `/tmp`; subsequent
    startup passed. The HTTP smoke client then exposed Node fetch discarding the
    test Host override. Replaced that test transport with explicit Node HTTP.
16. ShellCheck initially flagged intended in-container expansions and dynamic
    source locations. Added precise annotations; ShellCheck and actionlint passed.
17. Gitleaks reported no leaks in the one-commit repository history and in a
    snapshot of all Git-visible current files. Ignored environments, mail and
    backups were not copied to the snapshot. Output was fully redacted.
18. Lockfile audit: 278 package entries, no missing integrity hashes, no non-npm
    registry sources. Only esbuild/fsevents declare install scripts; container
    installs disable scripts. No new npm dependency was introduced.
19. Initial API/web Trivy scans timed out downloading the vulnerability database
    from `mirror.gcr.io`. They are **not passing vulnerability results**. An
    official `ghcr.io/aquasecurity/trivy-db:2` fallback also hit its 90-second
    deadline. This initial download blocker was subsequently resolved in step 23;
    no vulnerabilities were waived or presumed absent.
20. Final ShellCheck and actionlint passed after all procedure/workflow updates.
21. Final production-container smoke **passed**: same-origin proxy, SPA routes,
    blocked demo/source/private readiness routes, unauthenticated denials, security
    headers, Secure/HttpOnly/SameSite cookies, CSRF denial, authenticated login,
    runtime DDL denial, fresh-volume custom-format backup/restore, repeatable
    migrations/grants, restored-session invalidation, same-schema image
    recreation/rollback, preserved account data, non-root/read-only/port isolation,
    and production asset exclusion checks.
22. Final deployment-test syntax and `git diff --check` passed. No changes were
    committed or pushed. Production, DNS, Resend account and existing local
    application database remain untouched.
23. Retried with Aqua's official `public.ecr.aws/aquasecurity/trivy-db:2` repository.
    Download succeeded. CI/release workflows now use this source; actionlint passed.
    The database was updated at `2026-11-05T13:09:41Z` and downloaded at
    `2026-11-05T17:13:50Z`. Scanned docker-save archives using pinned Trivy 0.76.1,
    `--skip-db-update --offline-scan --scanners vuln --severity HIGH,CRITICAL
    --exit-code 1`. The offline flag reused that freshly downloaded database.
24. Original images failed: API **39 HIGH / 1 CRITICAL**, web **5 HIGH / 1 CRITICAL**,
    database **72 HIGH / 4 CRITICAL** package-CVE occurrences. These are scanner
    detections, not a claim that every advisory was reachable in EMS. Findings
    included Debian system packages, npm's unused bundled dependencies, Alpine
    packages with available fixes, and Go libraries inside the database's `gosu`.
25. Replaced runtime bases with digest-pinned Node 24 Alpine, Nginx stable
    Alpine slim, and PostgreSQL 18 Alpine. Applied signed Alpine package updates.
    Removed unused npm/Yarn from the API and `gosu` from the database; PostgreSQL
    now starts directly as non-root `postgres`. No ignore list, severity downgrade,
    or `--ignore-unfixed` flag was used. All three final scans passed with
    **zero HIGH/CRITICAL findings**. No existing database volume was converted.
26. The first Alpine API build caught a different font-package path; it failed
    closed. The Dockerfile now copies and verifies the font at a stable explicit
    application path. Found Windows CRLF versus Linux LF migration hashes as well:
    checksum checks now accept these equivalent encodings while rejecting SQL
    changes. Applied SQL files and existing migration journals were not rewritten.
27. Retested the checksum change: **27 API unit tests**, **51 Windows integration
    results**, and **51 Alpine/Linux integration results** passed. The latter run
    used an isolated network-disabled container matching the production libc.
    API syntax checks passed.
28. Read-only public DNS checks confirmed GoDaddy nameservers
    `ns47.domaincontrol.com` / `ns48.domaincontrol.com`, existing root MX
    `0 receive-apne1.forge.rmta.net`, and root DMARC `p=quarantine`. Preserve them.
    The proposed EMS hostname and sending-subdomain records were absent. These
    public checks do not substitute for a full authenticated zone inventory.
29. Connector discovery succeeded on retry: no apps were connected, Cloudflare
    was offered, and Resend/GoDaddy were not offered. A Cloudflare connection
    action was provided but authentication has not been confirmed. No account
    settings or DNS records were changed.
30. The exact hardened images passed the full production-container smoke,
    including native Argon2 login on musl, rendering with the bundled PDF font,
    missing npm/Yarn/gosu assertions, non-root fresh-volume PostgreSQL bootstrap,
    proxy/auth checks, logical backup/restore, restored-session invalidation and
    same-image/schema recreation. This is not a historical-release rollback or
    language-specific glyph-acceptance test. Log: `tmp/ems-hardened-container-smoke.log`.
31. Final `git diff --check` and redacted Git-visible source-snapshot secret scan
    passed. Git reported normal LF/CRLF conversion warnings, not diff failures.
    Docker reported no running containers after the checks. No resources were
    pruned, no production actions were taken, and no changes were committed/pushed.

## Validation results

| Check | Actual result |
| --- | --- |
| Frontend Vitest | 199 passed, 18 files |
| API unit tests including Resend and portable checksums | 27 passed |
| PostgreSQL integration, Windows | 51 passed including parent tests |
| PostgreSQL integration, Alpine/Linux container | 51 passed including parent tests |
| TypeScript and Vite production build | Passed |
| API / deployment-test syntax | Passed |
| API, web and PostgreSQL image builds | Passed, runnable local tags loaded |
| Container smoke / synthetic restore / same-schema recreation | Passed |
| ShellCheck / actionlint | Passed |
| npm audit | 0 reported advisories |
| Gitleaks history / Git-visible working snapshot | No leaks reported |
| Lockfile integrity / source checks | Passed; no new npm dependency |
| Trivy HIGH/CRITICAL image gate | **Passed**, zero on all three final runtime images; no exceptions |
| Actual HTTPS domain / SMTP or Resend delivery | Not run, external access absent |
| Actual encrypted offsite restore / historical production rollback | Not run |
| Existing browser workflows / load / language-specific PDF acceptance | Not run |

## Current validation limits

- Local container smoke/recovery and the HIGH/CRITICAL image gate passed.
  This time-bound scan is not proof of zero vulnerabilities or VM readiness;
  re-scan the actual immutable release images with a fresh database in CI.
- The encrypted age backup shell procedure is prepared/linted; actual encrypted
  offsite recovery is not yet demonstrated.
- Existing older browser workflow scripts have stale UI selectors; they were not
  represented as current passing end-to-end acceptance.
- Synthetic Docker fixtures use unique `ems-ci-*` / `ems-restore-*` names and are
  stopped after checks. Their volumes are retained, not pruned.
  Final hardened passing projects: `ems-ci-6321a2be2a0d` and
  `ems-restore-6321a2be2a0d`. Earlier passing and failed synthetic volumes are
  also retained; nothing was pruned.

## Image scan evidence

Counts above are package-advisory occurrences and are limited to HIGH/CRITICAL.
No claim is made about lower severities or future advisories. Trivy image pin:
`aquasec/trivy@sha256:790fd66d1697395d8693d1acaa1ea702406a20f109b6fc7bac8db623eca6c06c`.

| Local image | Final local manifest ID | Scan report in ignored `tmp/` |
| --- | --- | --- |
| `ems-prep-api:20261105` | `sha256:4092fef1b1e82f5f88eb1176be77efd39934dd77f7c5dfdabc9a697bafd9c438` | `ems-api-hardened-scan2.json` |
| `ems-prep-web:20261105` | `sha256:227a0ea9efe287f684dc95fb47e0cf35e4ceb6a27fb378ac8298dbaf71e19dce` | `ems-web-hardened-scan.json` |
| `ems-prep-db:20261105` | `sha256:23cd742930bcded53391c2c7e5936cc228e74ef7068722a1febd2862ba45e1ab` | `ems-db-hardened-scan2.json` |

The reports identify image-configuration digests rather than multi-platform
manifest IDs; those are different identifiers. Local tags are test artifacts,
not published release digests. Initial reports are `ems-*-scan-final.json`.

## Production gates still open

- Read-only SSH access to VM 101 and verified SSH host identity.
- Inventory of existing VM services, ingress, ports, Docker networks, disk and memory.
- Resend sending-domain verification, sending-only API key and approved recipient.
- Approved public ingress method compatible with existing GoDaddy DNS and workloads.
- Reviewed production secrets, offsite encrypted backup destination and retention.
- Actual staging/production smoke, recovery drill, performance and business acceptance.
- Explicit authorization for any production change, public exposure or DNS write.

## Final private GitHub preparation, 5 November 2026

- Confirmed existing `main`, original commit `b1922bb`, configured Git author and
  an existing `origin` pointing to a different repository. Preserve that remote
  and history; the proposed private target needs a confirmed owner and separate
  `ems` remote. GitHub CLI is not installed. No remote repository was created or
  written, and private target visibility/protection has not been verified.
- Repeated all-ref history and Git-visible working-tree secret scans before
  staging: no detections. No tracked private/generated paths. Expanded ignores
  for env variants, certificates/keys, token files, archives/backups and local
  data while retaining only explicit environment examples and SQL migrations.
- Reviewed every modified/new file, including a bounded independent frontend
  review of 49 paths. No publication-blocking secret or real employee data was
  identified. The complete 114-file change manifest is in document 28.
- Added GitHub approval-policy validation before privileged jobs, plus actual
  independent run-approval verification before image publication or SSH.
  Repository must be private; selected branch must be `main`; required reviewers
  must prevent self-review. API errors, unprotected environments and re-run
  attempts fail closed. Exact-release successful main CI remains mandatory.
- Confirmed current GitHub documentation: required reviewers for private
  repositories need an eligible Enterprise plan. Account eligibility is unknown,
  so protected publication/deployment is still an external blocker.
- Added fresh reviewed recovery-evidence and backup prerequisites before
  deployment migrations, previous-release requirements for upgrades, internal
  proxy health checks and same-schema application-only failure recovery.
  Incompatible recovery stops only EMS application services, retains DB/volumes,
  and leaves the release failed. Added explicit unmanaged named-volume/network
  collision refusal, including resources lacking Compose project labels.
- Four new Node publication/approval tests and nine mock release scenarios passed.
  Initial ShellCheck findings exposed ineffective negative test assertions; those
  were corrected, the harness rerun, and final ShellCheck/actionlint passed.
  The harness has no Docker socket and is not a live production recovery drill.
  No application dependency/source or runtime image changed in this final pass;
  earlier app tests and time-bound image scan evidence were carried forward.
- Cloudflare is now connected. A read-only exact-name `ebonstudio.com` zone query
  returned zero accessible zones. Public DNS still resolves GoDaddy NS and
  `0 receive-apne1.forge.rmta.net` MX; the app hostname A query is NXDOMAIN.
  No nameserver, DNS, account or tunnel setting was changed.
- The guest LAN endpoint is known privately, but no authorized SSH user,
  deployment identity or verified host key was supplied. No SSH connection,
  production command, migration, email or existing-workload change was attempted.
- Resend dashboard DNS values, private GitHub setup, VM inventory, usable encrypted
  offsite recovery, actual HTTPS/delivery and business acceptance remain blocked.
  Local `age` is absent. No restore evidence has been fabricated.
- Document 28 now contains setup/commit/push commands, environment/secret tables,
  approvals, VM commands, DNS/email prerequisites, backup/recovery, rollback,
  feature acceptance and the exact next owner action. The local preparation commit
  is intended to extend the original history; obtain its actual identity with
  `git log -2 --oneline`. No push is authorized by this log.
