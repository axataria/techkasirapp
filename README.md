# TechKasir local web app

A working local build for a laptop/phone store, based on [PRD.md](PRD.md), [WORKFLOWS.md](WORKFLOWS.md), [ERD.md](ERD.md), and [DESIGN_REVIEW.md](DESIGN_REVIEW.md).

## Run

Requires Node.js 24 or newer. No package installation is needed.

```powershell
node server.mjs
```

Open `http://127.0.0.1:3000`. On the first visit, create the owner account and enter the opening cash balance. The app stores data in `data/store.db`. The server binds to localhost by default.

To run the integration checks:

```powershell
node test.mjs
```

The checks use a separate temporary database. They do not alter the store's data.

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

The Table05 reference is integrated with live app records using the existing native JavaScript frontend. Its shared component is `public/data-table.js`, its styles are in `public/style.css`, and `public/app.js` initializes it after rendering. This app does not use React, TypeScript, Tailwind, or shadcn; the native integration needs no extra packages or build step. A `/components/ui` directory is appropriate for reusable React/shadcn components in a React project; the served native modules here live directly under `public`.

List tables support local search, sorting by column, 5/10/20 rows per page, numbered pagination, and row selection with a selected count. Select all applies to the current page. Currency sorts by rupiah value. The three-dot row menu contains only the actions the current account can already perform, including invoices and payments. Selection does not modify records. Table controls retain their state while navigating in a session and reset on logout. Dashboard summary tables stay compact.

Run `node data-table.test.mjs` for filtering, sorting, and pagination checks.

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

This is a **local development build**, not a production deployment. It is bound to one computer and uses SQLite. The original Excel import, customer returns/refunds, spare-part stock, customer follow-up notes, automated backups, email invitations, automated password recovery, and a downloadable PDF generator are not implemented yet. Payment documents can be printed or saved as PDF from the browser. Reports have a year filter; a custom date-range profit and loss report is still to be built.

The service accounting policy follows the PRD's proposed default: the service charge is customer revenue and technician cost is separate. Confirm this with the store owner before using profit figures operationally.

To make a consistent manual backup while the app is local, stop the server, then copy the `data` folder to another location. Restore by stopping the server and replacing that folder with the backup. Production use needs scheduled backups, HTTPS, and a hosting/database decision.
