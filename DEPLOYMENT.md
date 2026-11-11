# Firebase Spark + Supabase

Public site: https://kasirlaptoplab.web.app
Firebase project: `techkasirapp-axataria`, Hosting target `app`, **Spark**.
Supabase project: `techkasirapp` (`eumlynnylgdlscpednor`, Mumbai).
API: https://eumlynnylgdlscpednor.supabase.co/functions/v1/techkasir-api

## Architecture

Firebase Hosting serves the static Next.js export in `out/`. Application routes are generated at build time; authenticated data is fetched in the browser. Firebase App Hosting, Cloud Run, Cloud Functions, and Blaze billing are not used. `firebase.json` has no backend rewrites. The former `apphosting.yaml` has been removed.

Supabase Edge Functions run the same business handlers used by the local Node app. PostgreSQL stores accounts, sessions, inventory, invoices, payments, and reports in the private `techkasir` schema. The backend switches to the restricted `techkasir_app` role, with RLS and no table grants to browser roles. Database credentials and service-role keys are never embedded in the frontend.

The Edge Function validates the app's own random bearer sessions, so its Supabase JWT gateway check is disabled intentionally. Login, registration, bootstrap and recovery are public; other endpoints check an active session, store and staff permissions. Sessions last eight hours, are stored in browser `sessionStorage`, and are revoked on logout/password reset. Login limits are stored in PostgreSQL across function instances. Closing a tab ends its local session. Local Node development retains its HttpOnly cookie sessions.

Only `https://kasirlaptoplab.web.app` is allowed by browser CORS. Invoice previews and payment documents are fetched with authorization; tokens never appear in document URLs. Shared links require the recipient to sign in. The static frontend sets a Content Security Policy and security headers.

## Build and publish

Use Node.js 24:

```powershell
npm ci
npm run package:edge
npm run build:static
firebase deploy --only hosting:app
```

The Hosting predeploy hook rebuilds the static export. `NEXT_PUBLIC_TECHKASIR_API_URL` is a public endpoint; the build script defaults it to this project's Edge Function. No private database variables are required to build or deploy Hosting.

`npm run package:edge` assembles shared server modules into `supabase/functions/techkasir-api/`. Generated copies are ignored by Git. Deploy the function using the Supabase connector or authenticated CLI, with `deno.json` as its import map and `verify_jwt=false`. The function reads the server-side `SUPABASE_DB_URL` secret and switches to the restricted application role. `TECHKASIR_DATABASE_URL` can override the connection server-side. The static site needs no secret.

Supabase Free has usage limits and may pause projects with low activity. Firebase Spark has Hosting quotas. Neither a paid plan nor a keepalive automation has been enabled.

## Local development and existing data

`npm run dev` runs the complete local app with SQLite. `npm run dev:postgres` uses the gitignored `.env.cloud.local` connection instead. The original SQLite installation was found at `D:\Web%20App%20Dev\techkasirapp-main\data\store.db` (a legacy encoded path), with two accounts and no business transactions. Preserve that source and use the published site for subsequent work after cutover.

For an initial import, pause local writes, retain a consistent backup, then run:

```powershell
node --env-file=.env.cloud.local scripts/database/import-sqlite.mjs PATH_TO_STORE_DB
```

The importer opens SQLite read-only, requires empty destination tables, preserves IDs/password hashes, verifies every row and imports all tables in one transaction. It refuses to overwrite a populated destination. This is not ongoing synchronization. Arrange database exports/backups appropriate for daily business use.

## Verification

```powershell
npm test
npm run typecheck
npm run build:static
```

The optional PostgreSQL suite requires a separate `techkasir_verify_...` schema and refuses production. Hosted Edge workflows also require an isolated schema and temporary verification gate. Checks cover exact currency, store/staff permissions, idempotent payments, receiving, QC, returns, warranty, invoices, CORS and session revocation. Never point fixture tests at production.

The public Supabase CA is bundled for verified PostgreSQL TLS. `DATABASE_CA_CERT` can supply a replacement CA server-side after a provider rotation.

## Data loading performance

The frontend routes Supabase requests to the database region, Mumbai (`ap-south-1`), using `forceFunctionRegion`. Page data is fetched through one authenticated, read-only batch request instead of separate concurrent HTTP calls. Each batch enforces the original endpoint's permissions and uses a consistent database snapshot. Identical queries are reused only inside that read-only request; data is not cached across users or requests. A rejected subrequest is fully settled before the database connection is released.

Monthly reports preload sale/return data once for all twelve months. Sales lists fetch payment totals and return credits with joins instead of separate queries for each row. Bootstrap and the current user are combined in `/api/session`, and login returns the user's sanitized profile.

Measured against the existing isolated QA store on 11 November 2026: dashboard requests previously took 4,828 ms together; the new Mumbai batch took 166–218 ms in warm tests. Individual list/report responses were compared with saved pre-change responses and matched exactly. Eleven regression groups and TypeScript passed, including historical inventory, resale, supplier returns, large currency and mixed batch permissions. Cold startup and the user's network can still add latency.

HTML and route data revalidate with `Cache-Control: no-cache`; hashed Next.js assets keep their immutable one-year cache. Refresh existing tabs once after this release to replace any HTML cached under the previous one-hour policy.

## Release verification, 11 November 2026

The Spark Hosting release and Supabase Edge Function are deployed. Both original accounts and their password hashes were imported after a consistent SQLite backup was saved under the gitignored `data/backups/` directory. Every imported row was verified.

All 10 local regression groups, TypeScript, the static export, hosted core/V2 workflows, and browser login/invoice/reload/logout checks passed. Supabase security advisors reported no findings. Temporary QA data is isolated in the `QA Spark acceptance dec68e9e` store and `techkasir_verify_spark` schema; deleting those resources is awaiting explicit approval after automatic review blocked the permanent cleanup.
