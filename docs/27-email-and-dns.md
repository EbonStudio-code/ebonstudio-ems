# Resend email and DNS plan

**No DNS records, provider settings or existing mail services were changed.**
Actual Resend domain status/key and authenticated GoDaddy zone export were not available.
Public DNS was queried read-only on 5 November 2026; observations appear below.

## Email feature inventory

| Feature | Before | Prepared now |
| --- | --- | --- |
| Employee invitation/resend/reinvite | SMTP/private local preview | Also Resend backend API, durable encrypted queue |
| CEO initial setup/resend | Controlled CLI, no default password | Also queued Resend; real recipient approval still required |
| Password recovery/reset | Generic response, hashed expiring single-use tokens | Same protection plus resilient Resend delivery |
| Employee email change/reactivation | Reinvitation, session revocation | Same flow with Resend |
| New/edited task notification | Not present | Generic link to current assignee |
| Leave submission/decision/cancellation | Not present | Generic link to CEO or owning employee, based on actor |
| Complaint creation/reply/state | Not present | Generic private-conversation link to the other party |
| Published/voided salary slip | Not present | Generic link to active owner, no amounts or attachment |
| Holiday broadcasts / reminders | Not present | Not implemented; avoid unsolicited broadcasts |
| Delivery/bounce webhook dashboard | Not present | Not implemented; use Resend dashboard for delivery/bounces |

`HR_NOTIFICATIONS_ENABLED=false` is the safe production default until notification
policy approval. Notifications exclude inactive accounts, self-notifications,
complaint text, leave reasons, salary figures, task titles and PDF attachments.
They link to the login-protected workspace, not directly to private data.

## Provider, secrets and retry design

`MAIL_MODE=resend` calls the **official `POST https://api.resend.com/emails` REST
API** from the backend. Native Node fetch avoids an unnecessary SDK dependency.
`RESEND_API_KEY` is a production backend environment variable, loaded from the
protected Compose secret file at startup. It is not a Vite variable, build argument,
source literal or workflow secret needed by CI. Use sending-only access restricted
to the verified domain.

Suggested isolated sending domain: **`notify.ebonstudio.com`**.
Suggested sender: **`Ebon Studio EMS <no-reply@notify.ebonstudio.com>`**.
These are proposed configuration values, **not claims of verification**.
Set `MAIL_FROM_DOMAIN=notify.ebonstudio.com` and the exact `MAIL_FROM` after
Resend verifies the domain. There is no automated domain purchase/creation.
Keep click/open tracking disabled for security links.

Account tokens remain hashed in `account_tokens`. Durable email payloads contain
the link only under AES-256-GCM encryption, bound to the queue ID with a separate
`MAIL_OUTBOX_KEY`. Enqueue happens in the same DB transaction as token issuance,
so process death between commit and provider I/O does not lose the job. HR queue
rows initially contain only identifiers and template kind; delivery payload is
encrypted and frozen on the first attempt to keep retry idempotency stable.

Dedicated worker uses atomic row leases/`SKIP LOCKED`, a 10-second provider timeout,
stable per-job `Idempotency-Key`, bounded exponential backoff plus jitter,
Retry-After, and up to 8 attempts within token expiry / 23 hours (less than Resend's
24-hour idempotency window). Network errors, 408/425/429 and 5xx retry. Permanent
4xx failures stop. Deactivated users, superseded/consumed tokens and changed email
addresses cancel delivery. Expired jobs do not send. Payloads are cleared on
accepted/failed/cancelled outcomes, metadata cleaned after expiry plus 7 days.
Rotating the encryption key while pending jobs exist requires a planned drain or
cancel/reissue, not blind replacement.

Logs contain queue ID, kind, attempt, outcome and safe code only. Provider response
bodies, recipient addresses, tokens and credentials are not logged. `accepted`
and legacy account `sent` mean **provider accepted**, not recipient delivery.
No provider call was made with a real key or recipient during local tests.
Failed invitation jobs are reissued by authorized CEO/CLI; recovery can be
requested again. Do not automatically replay jobs after the idempotency window.
Persistent queue failures and bounces require operational alert/review.

## Resend DNS, preserve GoDaddy mail

### Public DNS observations (not a complete authenticated zone export)

- Authoritative NS: `ns47.domaincontrol.com`, `ns48.domaincontrol.com` (GoDaddy).
- Existing root MX: priority **0**, `receive-apne1.forge.rmta.net`. Preserve it.
- Existing root DMARC: `p=quarantine`, `adkim=r`, `aspf=r`, with an existing reporting
  destination. Preserve the full current record and reporting destination.
- No root TXT beginning `v=spf1` was returned by this resolver query. This is not
  authorization to add or replace root SPF; confirm with the account owner.
- `ems.ebonstudio.com` A lookup returned NXDOMAIN.
- Proposed `_dmarc.notify`, `send.notify` MX and `resend._domainkey.notify` TXT
  lookups returned NXDOMAIN. Names must still be verified against the current zone
  and Resend domain settings before any approved write.

The root's quarantine policy applies to subdomains unless overridden. **Do not
create `p=none` on the sending subdomain**, which would weaken the observed policy.

First inventory existing records (NS, A/AAAA, CNAME, MX, TXT, SPF/DKIM/DMARC, CAA,
DNSSEC). Export a zone backup before any approved write. In the existing Resend
account, inspect/add the dedicated sending subdomain and selected region. Copy
the exact record names, types, values and priorities from that domain's DNS panel.
Keys and regional targets cannot be derived locally.

GoDaddy relative names below assume its zone is `ebonstudio.com`:

| Purpose | Type | GoDaddy name (illustrative) | Required value |
| --- | --- | --- | --- |
| Resend DKIM | TXT (or exact provider type) | `resend._domainkey.notify` | Exact generated DKIM public value from Resend |
| Return-path SPF | TXT | Dashboard-specified name | **Blocked:** copy exact value from Resend; no value assumed |
| Return-path bounce routing | MX | Dashboard-specified name | **Blocked:** copy exact target and priority from Resend; no region assumed |
| Sending-subdomain DMARC | TXT | `_dmarc.notify` | Prefer inheriting current root quarantine policy (no new record); if explicitly needed/approved, at least `v=DMARC1; p=quarantine; adkim=r; aspf=r` |

The return-path name can differ if customized. **Use the actual dashboard
records, not guessed values.** Do not put the bounce MX at `@` or replace
`ebonstudio.com` MX records. Do not enable Resend receiving for the company domain.
Existing GoDaddy/Microsoft/Google mail MX, autodiscover, SPF and DKIM stay untouched.
Do not create two SPF or two DMARC records at the same hostname; merge/review where
needed. Dedicated subdomain SPF normally avoids changing the root SPF record.
If company DMARC already mandates stricter subdomain policy, do not weaken it.
No `rua` address is invented and the existing root reporting destination is
preserved. Any subdomain reporting override requires an approved monitored mailbox.
DKIM/SPF records must remain DNS-only, not HTTP-proxied.

Required proof before sending real invitations: verified domain status, authorized
sender, a sending-only key, an explicitly authorized test recipient, and a received
message's Authentication-Results showing SPF/DKIM/DMARC pass. Local mocks do not
prove deliverability or DNS authentication.

## EMS public application DNS

Exactly one ingress strategy must be approved after VM inventory:

### Keep GoDaddy authoritative DNS and use approved existing HTTPS ingress

- `A ems` → the confirmed public ingress IPv4 (not VM private IP).
- Optional `AAAA ems` only if IPv6 ingress, certificate and routing are verified.
- Or `CNAME ems` → an existing approved ingress hostname, instead of A/AAAA.
- Certificate ACME DNS-01 may require `_acme-challenge.ems` TXT with a provider-issued
  temporary value; HTTP-01 requires an approved port-80 route. Follow the existing
  ingress certificate process. Do not add competing records.
- No public PostgreSQL/API record and no database port forwarding.

### Dedicated Cloudflare Tunnel

The application hostname must be onboarded correctly to the **same Cloudflare
account as the tunnel**. A plain GoDaddy CNAME to `<UUID>.cfargotunnel.com` alone
does **not** establish a supported public hostname/certificate setup.

Standard full-zone setup requires Cloudflare authoritative nameservers, a sensitive
zone migration with existing records and DNSSEC coordination. Do not do this merely
for EMS without explicit authorization. GoDaddy may remain the registrar.
Keeping GoDaddy authoritative requires an eligible Cloudflare partial/CNAME setup
(plan/ownership verification and its exact assigned DNS target), or an eligible
delegated subdomain setup. Eligibility and exact validation records must be
confirmed in the account; none were assumed.

For an approved standard Cloudflare-managed hostname:
`CNAME ems` → `<TUNNEL_UUID>.cfargotunnel.com`, proxied, in the onboarded zone.
For an approved partial setup, use Cloudflare's exact external CNAME/verification
records at GoDaddy, not an invented target. No A/AAAA origin exposure is required.
Any NS/DNSSEC/CAA change or existing DNS replacement is separately approved.

## Read-only Cloudflare verification (5 November 2026)

The Cloudflare connector is now connected. An exact-name zone query for
`ebonstudio.com` returned zero accessible zones. This can mean a different account
or insufficient zone permissions; it does not prove the domain is absent from
every Cloudflare account. Public NS still point to GoDaddy, not Cloudflare.
No tunnel API is exposed by the current connector tools, and no tunnel was created
or inspected. Confirm the correct account, eligible zone setup and dedicated
tunnel configuration before approving that route. Do not change nameservers.

## Required external access (still missing)

1. Resend domain status/region and DNS record export, sending-only API key.
2. GoDaddy read-only zone inventory, existing MX/SPF/DKIM/DMARC/CAA/NS information.
3. Public ingress address or Cloudflare account/zone/plan and dedicated tunnel token.
4. Approved sending-domain/sender and test recipient.

Resend/GoDaddy were not in the offered connector catalog. Their authenticated
dashboards or a nonsecret DNS export are still required; no API credentials are
requested in chat. Only the Cloudflare read-only zone query above was performed.
Never paste API keys, SSH keys, mail tokens or production `.env` contents into chat.

Official references reviewed:
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/dashboard/emails/idempotency-keys
- https://resend.com/docs/dashboard/domains/introduction
- https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/dns/
