# 15. Connected workspace and local setup

**Checkpoint: 31 October 2026.** Connected React/Express/PostgreSQL workflows are implemented. The authorized local database backup/migration/grants and fictional CEO invitation are complete. Website password activation and company settings remain user steps. This is not a production release.

## Three different logins

1. **Local PostgreSQL / owner**, such as `postgres`: used only for database backup and schema upgrades. Credentials belong in ignored `apps/api/.env.admin`.
2. **EMS App Connection / runtime**, currently `ems_app`: normal limited database access for the API. Credentials remain in ignored `apps/api/.env`.
3. **Website CEO**: a separate application account with its own login email and password.

The user initially found the technical setup questions unclear. Explain these separately, one step at a time. PostgreSQL's server login password is not the pgAdmin master password or the website CEO password. Never ask for passwords in chat.

## Actual local setup record

- The initial owner authentication error `28P01` was resolved after the user supplied the Local PostgreSQL password in `.env.admin`.
- Only missing nonsecret `PGHOST`, `PGPORT` and `PGDATABASE` fields were added, matching the runtime target. Both database logins then passed.
- `npm run setup:local --workspace @ems/api` backed up `employee_management_dev`, adopted the exact compatible manual 001, applied 002, and granted limited runtime table access.
- Existing accounts stayed **0 before and after migration**. The later explicitly approved **Demo CEO / `ceo@example.test`** bootstrap created the single invited account.
- Runtime checks confirm no public-schema CREATE and no DELETE permission on accounts. No database reset, password change or real employee import occurred.
- API liveness/readiness on port 3000 returned 200, and readiness through the normal frontend proxy on port 5173 returned 200.
- Latest account state: **INVITED**. Company settings: **not configured**. No website password was generated or chosen by the assistant.

Backup:

```text
D:\LEARN - TEST\EMPLOYE MANAGEMENT BACKUPS\2026-10-31T10-53-45-757Z-20fc3268-before-connected-api\database.dump
```

Custom archive: **3,436 bytes**. SHA-256: `b10bfe62427381692f90eedbb35e895eaab4cd4927c92f2901c699d024379065`. The adjacent manifest records the checks. Format/list/checksum validation passed; an actual-data restore drill, encryption and offsite backup are not claimed.

## Finish the website login

The user selected a fictional CEO for testing and approved local-only setup delivery. `.env` now contains the explicit preview-delivery and fictional bootstrap identity settings; existing database passwords were preserved.

Open this private local file in an editor:

```text
apps/api/.local-mail/0a11b2c2-fb1b-4b47-b239-f1ab5c199459.json
```

Copy its `url` value into the local browser, choose and confirm a 12–128-character website password, then sign in at `http://127.0.0.1:5173/login` with `ceo@example.test`. Do not share the file/link or paste its token into chat. The single-use invitation lasts 24 hours. If it expires while the account remains invited, use the documented `bootstrap:ceo -- --resend` command.

After login, explicitly enter company name, timezone, workweek, currency and leave labels. Do not treat UTC/USD from synthetic tests as the real company's decisions. Salary publication remains separately gated by reviewed legal/company details.

No real email was sent. Preview delivery writes private local files. Restart an already-running API after changing `.env` so future delivery/configuration changes take effect.

## Routes and implementation

| Mode | Entry point | Data/access |
| --- | --- | --- |
| Connected | `http://127.0.0.1:5173/login` | API sessions/PostgreSQL; no default password or role switcher |
| Fictional preview | `http://127.0.0.1:5173/preview/login` | Preserved demo browser records/role switcher; no backend needed |

Connected feature paths remain `/ceo/*` and `/employee/*`; prefix them with `/preview` for the demo. Existing `ems.frontend-demo.v1` and `ems.preview-session` keys remain untouched by connected workflows. No demo records are imported into PostgreSQL. Private API responses remain in memory; only shared theme preferences are browser-saved.

`apps/web/src/live` contains the typed client, session/resource state, forms and all feature pages. It implements cookie/CSRF rotation, fragment capture/removal, login/recovery/setup/password change, capability navigation, server pagination, versioned mutations, explicit company setup, employee lifecycle, scoped dashboards, punches/corrections, leave/history, tasks, private complaints, holiday impact and salary draft/publish/void/PDF workflows.

Reads are abortable. Private state clears on logout/expiry/account change. Cross-tab notifications and focus/visibility/back-forward-cache checks revalidate sessions. Generation checks before mutations and after response headers/body parsing discard stale responses. Failed or ambiguous creates are not automatically retried.

Run `npm run dev:api` and `npm run dev` in separate terminals if not already running. Vite proxies `/api` to `http://127.0.0.1:3000`; `EMS_API_TARGET` can override that target. API `APP_ORIGIN` must exactly match the browser origin, normally `http://127.0.0.1:5173`. Asset preview on 4173 needs its matching API origin. Production requires a reviewed HTTPS same-origin proxy.

## Verification

| Check | Result |
| --- | --- |
| Frontend Vitest | 95 passed: 82 preview and 13 API-client tests |
| Backend unit/foundation | 14 passed |
| Isolated PostgreSQL integration | 41 scenarios passed, reported as 43 tests including two parents |
| Connected browser journeys | 31 assertions passed, zero failures |
| Preserved preview browser regressions | 50 assertions passed, zero failures |
| TypeScript/build/API syntax | Passed |
| Dependency audit | Zero reported vulnerabilities |

Reports: [connected browser](evidence/connected-browser-2026-10-31.json) and [preview browser](evidence/preview-browser-2026-10-31.json). The connected suite was rerun after the session fixes and again passed all 31 assertions. The build retains two nonblocking Zod comment-annotation warnings.

Connected evidence covers both roles, company reload, invitations/reset validation and redemption, employee phone updates, punches, leave preview/approval, hostile complaint text rendered literally, directory denial, tasks, complaint resolution/closure, holiday impact, salary publish/void, authenticated PDF bytes, 360-pixel layout/mobile navigation, revocation and unchanged demo storage.

Initial-session/CSRF and delayed-response account-change races were fixed. Harness corrections included metadata-safe field selectors, current-error waits, repeat-run holiday dates, action labels and relocated preview links.

The setup regression checks target/password/elevated-role rejection before DDL, archive checksum, compatible baseline, account preservation, limited permissions, repeatability and restoration into a separate empty synthetic database. Tests never load the user's `.env`.

### Reproduce isolated browser checks

Start `node scripts/browser-fixture.js` from `apps/api`, then in a separate terminal from `apps/web`:

```powershell
$env:EMS_API_TARGET='http://127.0.0.1:3006'
npm run dev -- --port 5186
```

At `http://127.0.0.1:5186/login`, run `import('/tests/connected.browser.js').then(m => m.runConnectedChecks())` in the browser console. Wait until `window.__connectedChecks.running` is false. This script refuses other origins and uses a uniquely isolated PostgreSQL cluster, synthetic credentials, fake mail and a separate cookie name. Never mount its test endpoints in the normal API.

When done, POST `/api/v1/__browser-test/stop` through the test origin, then stop only that test Vite process. The implementation pass stopped and removed its synthetic database and both test frontends; normal ports 3000/5173 were left running. Preview regression instructions remain in [document 13](13-qa-fixes.md).

## Remaining acceptance

- The CEO must choose the website password and company settings. No account activation is claimed.
- Browser evidence is DOM/state/geometry and authenticated blob bytes, not screenshot approval or OS download/print completion.
- Native Tab/Escape testing was blocked: the desktop browser pane was hidden and rejected keyboard input. No focus-trap pass is claimed.
- A narrow axe login audit reported zero violations; the hidden-viewport directory audit had an incomplete contrast check. These do not establish full accessibility or screen-reader compliance.
- Historical external QA statuses remain unchanged. Keyboard, screenshots, company-language PDF layout, actual-data restore, SMTP/HTTPS/proxy/security, load and release acceptance still require review.
- No real invitations, public deployment, paid infrastructure or statutory payroll claim was added.
