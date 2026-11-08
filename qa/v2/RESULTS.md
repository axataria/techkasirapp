# V2 verification — 8 November 2026

## Automated checks

`node verify.mjs`: all 8 checks passed.

- Existing integration, dashboard, search, components, tables, and precise-money/domain tests passed.
- V2 integration passed: atomic receiving, serial conflict rollback, QC gates and history, idempotent sales/payments, policy snapshots, warranty claim transitions, return credit/refund, resale, supplier refund/credit/replacement, transferred capital, repair cost, reporting, redaction, role access, and restart.
- V1 fixture migration preserved existing active session, account, record IDs, invoices, payment snapshots, audit, and balances; backup and foreign keys verified.
- `node qa/v2/check-local-migration.mjs` passed on a consistent read-only copy of the local store.
- After the main server migrated, fingerprints of **every legacy table** matched the pre-v2 backup. SQLite integrity was `ok`; foreign-key errors: `0`.
- Protected baseline comparison against Git HEAD passed: `public/style.css`, `public/theme.js`, and the complete login/setup rendering function remain unchanged.
- `git diff --check` passed.

## Browser observations

An isolated temporary database was used for browser actions. Demo customers, inventory, and transactions were never added to the store database.

- Desktop 1440 × 1000: all 12 sidebar items appear in the requested order; POS catalogue and cart form two columns; history list and selected detail form two columns.
- Edited an ASUS demo unit's selling price from Rp7.000.000 to Rp6.800.000. With Rp7.000.000 tender, the UI showed Rp200.000 change. Saving succeeded, removed that unit from the sellable catalogue, and produced an order/payment entry for Rp6.800.000.
- Order detail showed the invoice, payment document, channel, warranty, paid amount, and remaining balance. DP and paid examples appeared separately.
- Light/dark mode both retained the existing theme. Date filter alignment was corrected after visual inspection.
- Mobile 390 × 844: POS stacks the catalogue and cart; history opens a selected detail with a return-to-list action. Observed page width was 375px with a 390px viewport, with no page overflow.
- Catalogue and Report rendered against the real API responses of the isolated preview. The main local application was then opened at port 3000 and showed its existing login form.

Screenshots:

- [POS desktop](screenshots/pos-light-desktop.jpg)
- [Orders, dark desktop](screenshots/orders-dark-desktop.jpg)

The temporary viewport override was reset, the demo browser tab was closed, and the isolated preview server was stopped. The main v2 server remains running at port 3000. Detailed MVP limits are in [V2.md](../../V2.md).
