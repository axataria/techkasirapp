# Firebase App Hosting + Supabase

Firebase project: `techkasirapp-axataria`.
Public address: `https://kasirlaptoplab.web.app` (Hosting site reserved in this project; target `app`).
Supabase project: `techkasirapp` (`eumlynnylgdlscpednor`, Mumbai).

The production database is PostgreSQL in the private `techkasir` schema. Its dedicated `techkasir_app` login has access to app tables, not database administration. Tables have RLS policies for that backend role and no grants to browser roles. Existing app authentication, store isolation and staff permissions remain on the server. Supabase Auth is not required.

The custom Node server serves Next.js, `/api/*` and `/document` on one origin. `apphosting.yaml` overrides Firebase's build/start commands and includes the server files. The production build uses Next.js's Webpack builder, verified on the development machine. Local development can continue using SQLite. Cloud startup requires PostgreSQL and an explicit HTTPS app origin, so a missing secret cannot silently create an ephemeral SQLite database.

## Complete Firebase setup

1. Enable the Blaze billing plan for [the Firebase project](https://console.firebase.google.com/project/techkasirapp-axataria/usage/details). Set an appropriate billing alert. No billing account was attached during preparation.
2. Create an App Hosting backend in the Firebase console, connect `axataria/techkasirapp`, choose `main` and the repository root. Choose an available region near the Supabase database and your users. Use Node 24.
3. Store the server-only connection string as Cloud Secret Manager secret `techkasir-database-url`. A generated restricted connection is saved locally in the gitignored `.env.cloud.local`; do not paste it into source code or chat. Use the CLI's secret input prompt or stdin. Grant the backend access to the secret.
4. `apphosting.yaml` sets `TECHKASIR_APP_ORIGIN` to `https://kasirlaptoplab.web.app`. After the backend exists, obtain its actual Cloud Run service ID and region. Create `firebase.json` with Hosting target `app` and a `**` rewrite to that service/region, then deploy `hosting:app`. Do not substitute a guessed Cloud Run service ID. Firebase documents the rewrite configuration at https://firebase.google.com/docs/hosting/cloud-run#direct-hosting-requests-to-container. The Hosting site is reserved, but no app has been deployed there yet.
5. Deploy the prepared commit and Hosting rewrite. Import the existing local accounts at cutover, then verify `/api/bootstrap`, login, a customer, stock, a payment and a printable invoice through `kasirlaptoplab.web.app`. Verify the records remain after a redeploy.

App Hosting needs Blaze. `minInstances: 0` allows cold starts; `maxInstances: 1` limits the app to one instance for this small installation. These settings do not cap the total bill. Each instance uses a small PostgreSQL connection pool. Writes are serialized through a transaction advisory lock; responses are sent after the request commits.

## Existing local data

Preparation found the existing local database at `D:\Web%20App%20Dev\techkasirapp-main\data\store.db` (a legacy encoded path). It contains two stores/accounts and no customers, stock, sales or payments. It has not been imported into production yet: import at the final cutover after pausing local writes, so later local changes are included. Do not mistake the absence of `data/store.db` in the repository directory for an empty installation.

If a real `data/store.db` exists, stop writes and retain a backup before importing. Start the current local app once to complete existing SQLite migrations, then stop it. Run:

```powershell
node --env-file=.env.cloud.local scripts/database/import-sqlite.mjs data/store.db
```

The importer opens SQLite read-only, requires empty destination tables, preserves primary keys and password hashes, checks every imported row and commits all tables together. It never overwrites a populated cloud database. Keep a database export outside the hosting provider and arrange scheduled backups before relying on the app for daily business.

For this installation, pass the legacy path above instead of `data/store.db`.

## Verification

```powershell
npm test
npm run typecheck
npm run build
npm run test:next
```

The PostgreSQL workflow suite requires a separately provisioned copy of `scripts/database/schema.sql`, with `techkasir` replaced by a schema named `techkasir_verify_...`. It refuses the production schema and deletes only its own fixtures:

```powershell
$env:TECHKASIR_DATABASE_SCHEMA = 'techkasir_verify_YOUR_SUFFIX'
node --env-file=.env.cloud.local postgres.test.mjs
```

The Supabase CA certificate is public and bundled for verified TLS. If the provider rotates its CA, update it using the certificate supplied in Supabase Database Settings; `DATABASE_CA_CERT` can override it. Secrets must stay server-only.

Preparation checks passed on 11 November 2026: all 10 local regression groups, TypeScript, the production Webpack build, the Next.js workflow test with an HTTPS app origin, and the core/V2 workflows against Supabase (including restart persistence). An isolated SQLite import also verified every row, exact currency above JavaScript's safe integer range, policy ordering, and refusal to overwrite existing data. The temporary Supabase verification schema was removed afterward. The live Firebase rollout is pending Blaze activation.
