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

## Current limits

This is a **local development build**, not a production deployment. It is bound to one computer and uses SQLite. The original Excel import, customer returns/refunds, spare-part stock, customer follow-up notes, automated backups, email invitations, automated password recovery, and a downloadable PDF generator are not implemented yet. Payment documents can be printed or saved as PDF from the browser. Reports have a year filter; a custom date-range profit and loss report is still to be built.

The service accounting policy follows the PRD's proposed default: the service charge is customer revenue and technician cost is separate. Confirm this with the store owner before using profit figures operationally.

To make a consistent manual backup while the app is local, stop the server, then copy the `data` folder to another location. Restore by stopping the server and replacing that folder with the backup. Production use needs scheduled backups, HTTPS, and a hosting/database decision.
