# TechKasir V3 · 3.0.0

Satu proyek dan satu proses aplikasi. `npm.cmd run dev` menjalankan frontend Next.js, API toko, dan dokumen cetak bersama di **http://127.0.0.1:3100**. `server.mjs` adalah satu-satunya entry point aplikasi; backend berada di `src/server`. Gunakan `npm.cmd run verify` untuk pemeriksaan lengkap dan `npm.cmd run preview` hanya untuk data uji terpisah.

Versi aktif: **V3 (3.0.0)**. Panduan operasi, perbaikan fungsional, dan hasil verifikasi tersedia di [V3.md](V3.md).

Deployment cloud menggunakan **Firebase App Hosting + Supabase PostgreSQL**. Konfigurasi, secret, migrasi data SQLite, dan langkah aktivasi tersedia di [DEPLOYMENT.md](DEPLOYMENT.md). SQLite tetap tersedia untuk pengembangan lokal.

A working local build for a laptop/phone store. V2 follows [PRD-V2.md](PRD-V2.md); see [V2.md](V2.md) for implemented modules, migration, workflows, verification, and MVP limits. The original [PRD.md](PRD.md), [WORKFLOWS.md](WORKFLOWS.md), [ERD.md](ERD.md), and [DESIGN_REVIEW.md](DESIGN_REVIEW.md) remain historical references.

V2 adds the 12-item sidebar, a POS with a right cart panel, split order/payment history, catalogue and individual units, suppliers/receiving, QC, warranty claims, customer/supplier returns, and date-range reporting with CSV export. Authentication and the existing design system are retained. Finance/payments live under Report; staff/audit live under Settings; service jobs live in Order history.

Stop the previous server before starting v2. The first v2 startup creates a consistent pre-migration SQLite backup beside the store database. Existing accounts, sessions, records, and document IDs are preserved.

## Run

Requires Node.js 24. The frontend uses Next.js App Router, React, TypeScript, Tailwind CSS v4, and official shadcn/ui source components. The store API uses SQLite locally and PostgreSQL when `DATABASE_URL` is configured.

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://127.0.0.1:3100`. On the first visit, create the owner account and enter the opening cash balance. The app stores data in `data/store.db`. The server binds to localhost by default.

Untuk akun pemilik baru, pilih **Buat toko baru** di halaman login. Isi informasi toko dan akun pemilik, lalu tentukan tanggal serta saldo kas awal dalam rupiah. Toko baru dimulai dengan data operasional kosong. Akun staf yang dibuat lewat **Pengaturan → Staf dan akses** memakai data toko tempatnya ditambahkan. Saat pertama kali memuat skema pemisahan kode per toko, server membuat cadangan `data/before-store-isolation-*.db` jika sudah ada toko.

To run the integration checks:

```powershell
node verify.mjs
```

The checks use a separate temporary database. They do not alter the store's data.

## Kode pemulihan akun

Saat toko dibuat, TechKasir menampilkan **kode pemulihan simpanan** satu kali. Simpan kode di tempat aman. Pemilik yang sudah memiliki akun dapat membuat atau mengganti kode dari **Pengaturan → Profil akun** dengan kata sandi saat ini. Di halaman **Lupa kata sandi?**, masukkan kode simpanan dan kata sandi baru. Reset mengakhiri sesi lama dan menampilkan kode pengganti. Jalur ini dapat digunakan tanpa layanan email.

## Email pemulihan opsional

Atur variabel lingkungan berikut pada proses server untuk mengaktifkan kode pemulihan melalui Resend.

| Variabel | Nilai |
| --- | --- |
| `RESEND_API_KEY` | Kunci API Resend dengan izin pengiriman. |
| `TECHKASIR_RECOVERY_FROM` | Alamat pengirim dari domain yang sudah diverifikasi di Resend. |
| `TECHKASIR_RECOVERY_SECRET` | Rahasia acak khusus pemulihan, minimal 32 karakter. Buat dengan `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. |

Simpan nilai di lingkungan server atau di `.env` yang diabaikan Git. Jika menggunakan `.env`, jalankan `node --env-file=.env server.mjs --dev` untuk pengembangan, atau `node --env-file=.env server.mjs` setelah build. Mulai ulang server setelah mengubah konfigurasi. [Dokumentasi pengiriman Resend](https://resend.com/docs/api-reference/emails/send-email)

Setelah masuk, buka **Pengaturan → Profil akun** untuk mengubah nama atau username dengan konfirmasi kata sandi saat ini. Di bagian **Email pemulihan**, masukkan Gmail atau email lain yang dapat Anda akses dan verifikasi dengan kode yang dikirim. Dari halaman login, **Lupa kata sandi** mengirim kode ke email yang sudah diverifikasi. Kode berlaku 10 menit, dapat digunakan sekali, dan dikunci setelah lima tebakan salah. Pemulihan menampilkan username setelah kode berhasil dipakai dan mengakhiri sesi lama.

## Frontend architecture and styling

The active frontend lives in `src/app` and `src/components`. It uses real shadcn/ui React components installed through the CLI, with local Geist fonts, Phosphor icons, light/dark modes, saved palettes, and frosted glass surfaces. Layout and styling use Tailwind utilities. `src/app/globals.css` contains the Tailwind import and shared theme/material tokens.

`server.mjs` serves Next.js and routes `/api/*` and `/document` to the existing store handlers on the same origin, preserving session cookies and cross-origin write protection. `node server.mjs` starts the complete application. Backend modules live in `src/server` and have no standalone application entry point.

The previous frontend is archived under `qa/legacy-frontend` solely for historical regression tests. It is not served or loaded by Next.js. There is no active static HTML entry point or old stylesheet build.

For a production build and local start:

```powershell
npm.cmd run build
npm.cmd start
```

Use `npm.cmd run typecheck` for TypeScript checks and `npm.cmd run test:next` after building for Next.js route, asset, session, API, and origin checks. `npm.cmd test` runs the existing API/domain/migration checks plus historical frontend fixtures. The historical fixture checks do not represent coverage of the new React components.

Run `npm.cmd run preview` after building for an isolated seeded preview on port 3101. Its separate temporary database does not modify `data/store.db`. Preview login: `preview` / `preview-v3-only-2026`. Those credentials exist only in that preview store.

## Available now

- Owner and staff login, role-limited pages and API access, staff creation/deactivation, and owner-initiated password reset.
- Customer profiles with transaction history, DP, installments, and outstanding balances.
- Individually tracked laptop/phone stock, unit sales, and sale invoices.
- Service jobs, estimated deposits, final service invoices, and payments.
- Operating expenses, other income, losses, and payment records.
- A numbered printable document for each payment, including payment reversals.
- Dashboard, monthly profit/cash/inventory report, opening cash, and audit log.
- Global search from **Cari data** in the header or **Ctrl+K / Cmd+K**, with record previews and links to the relevant pages. Searches customers, units, sales, services, payments, expenses, other income, losses, staff, and the latest 300 audit entries, following existing role permissions.

## Data tables

The React table component uses shadcn/ui Table, Input, Button, and Select components. Business screens share the searchable and paginated grid in `src/components/data-grid.tsx`.

List tables support local search, sorting by column, 5/10/20 rows per page, numbered pagination, and row selection with a selected count. Select all applies to the current page. Currency sorts by rupiah value. The three-dot row menu contains only the actions the current account can already perform, including invoices and payments. Selection does not modify records. Table controls use React state scoped to each screen. Dashboard summary tables stay compact.

Run `node data-table.test.mjs` for historical table logic checks. The Next.js smoke test verifies the current application entry points; browser review is recorded in `NEXT-FRONTEND-PLAN.md`.

## Dummy data and invoice checks

After completing owner setup, run `node seed-demo.mjs` (or `npm run seed:demo`) to populate the local app. This adds 10 fictional customers, 20 units (10 sold and 10 stock units), 10 sales, 10 service jobs, and 10 records each for expenses, other income, and losses. Dummy records use `DUMMY` names/codes. Two inactive dummy staff accounts populate the staff list with cashier and technician roles; use separately created active accounts for login testing.

The 10 sale cases cover cash, transfer, QRIS, discounted deposit, unpaid invoice, three installments, deposit settlement, payment correction, payment reversal, and a 100% discount. Service cases include full payment, deposit before completion, unpaid completion, partial payment, free diagnosis, work in progress, waiting for parts, newly received work, and cancellation. Unfinished/cancelled services correctly have no final invoice.

The utility backs up the database to `data/before-dummy-<timestamp>.db`, preserves existing records and account credentials, and exercises the real local API. It verifies 16 invoices, all generated payment documents, overpayment rejection, receivable totals, and SQLite integrity. Details are saved in `data/dummy-data-report.json`. Running it again verifies the same dataset without adding duplicates. If you edit these dummy transactions afterward, their expected-value checks can fail; inspect the report instead of reseeding over edited records. A partial failed seed is rejected for manual inspection.

Refresh the app, open **Penjualan unit** or **Servis pelanggan**, and use **Lihat dokumen** to inspect invoices. Payment receipts and reversals are available in **Pembayaran**. Use **Cetak / Simpan PDF** in a document to test the browser print dialog. Financial reports include the dummy transactions dated November 2026.

## Database search

Use **Cari data** in the header or **Ctrl+K / Cmd+K** to search records stored in the local database. Search by name, phone number, transaction code, model, payment method, status, or category, such as `stok Samsung` or `pelanggan Dina`. Matching is case insensitive and requires every search word to appear in the record.

Search runs locally and does not use AI, external services, or API keys. Results include previews, links to the relevant pages, and pagination in groups of 20. Existing role permissions and hidden cost fields are preserved. This searches app records, not external files or the internet.

Run `node search.test.mjs` for keyword matching, permission, pagination, and local-only search checks. The main integration checks also cover global search and role restrictions.

## Current limits

This is a **local development build**, not a production deployment. It is bound to one computer and uses SQLite. The original Excel import, spare-part stock, customer follow-up notes, scheduled backups, email invitations, automated password recovery, and a downloadable PDF generator are not implemented yet. V2 supports full-unit customer returns/refunds and date-range profit and loss reporting; partial returns and special refund corrections remain outside the MVP. Payment documents can be printed or saved as PDF from the browser. See [V2.md](V2.md) for detailed limits.

The service accounting policy follows the PRD's proposed default: the service charge is customer revenue and technician cost is separate. Confirm this with the store owner before using profit figures operationally.

To make a consistent manual backup while the app is local, stop the server, then copy the `data` folder to another location. Restore by stopping the server and replacing that folder with the backup. Production use needs scheduled backups, HTTPS, and a hosting/database decision.

## V3 acceptance

Run `npm.cmd run verify` for TypeScript, production build, existing regression checks, and the extended Next.js business workflow integration. See [V3.md](V3.md) for the active release.
