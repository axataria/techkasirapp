# Product Requirements Document: Laptop & Phone Store Management App

**Status:** Draft for product decisions  
**Source:** `Pembukuan_Toko_Laptop_HP_Revisi_Stok_Otomatis.xlsx`  
**Audience:** Store owner, cashier, service staff, and developer  
**Primary language and currency:** Indonesian UI, IDR

The visual direction, review of all supplied reference components, and required app component states are specified in [DESIGN_REVIEW.md](DESIGN_REVIEW.md).
The operating flows are in [WORKFLOWS.md](WORKFLOWS.md), and the logical data model is in [ERD.md](ERD.md).

## 1. Product summary

Build a web app for a small store that buys and resells individually tracked laptops and phones, performs customer repairs, and records operating income, expenses, losses, payments, inventory, and profit. A store owner should be able to enter each event once and see stock, receivables, cash, and reports update immediately. The workbook is a template with formulas and no actual transaction history; this PRD specifies the intended workflow rather than asserting that its current reports have been validated with real data.

## 2. Goals and success criteria

| Goal | Acceptance measure |
| --- | --- |
| Prevent duplicate or invalid unit sales | A unit code is unique; a unit cannot have two active sales; only a ready unit can be sold. |
| Remove repeated manual entry | Unit details and cost appear automatically when a cashier selects a unit; reports derive from saved transactions. |
| Track money owed separately from revenue | Each sale, service job, expense, and other income shows billed, paid, and remaining amounts. |
| Make reporting reconcilable | Dashboard, monthly summary, and profit and loss use the same calculation rules and agree for the same date range. |
| Preserve accountability | Financial edits have an audit record with actor, time, old/new values, and reason. |
| Give staff controlled access | Each staff member logs in with an individual account and sees only permitted actions. |
| Document every payment | Every posted payment has a unique, printable payment document tied to its source transaction. |
| Track customers with a DP | A customer profile shows service and sale history, every deposit or installment, and the remaining balance per transaction. |

## 3. Users and permissions

| Role | Main capabilities |
| --- | --- |
| Owner/Admin | All modules; configure business and opening cash; view costs, profit, and audit history; correct or void transactions. |
| Cashier | Register unit sales and payments, view sellable stock and customer balances; no access to cost or profit unless granted. |
| Service staff | Create and update service jobs, parts used, work status, and service payments; no access to whole-store profit by default. |

Use one store/organization in the MVP. All write actions require an authenticated user. The owner can assign roles. Store timestamps in a consistent timezone and display them in Asia/Jakarta by default.

### Login and account access

- Owner receives the first account during store setup and invites each staff member to a separate account. No public self-registration in the MVP.
- Login accepts a unique login identifier and password. Show a non-revealing error for invalid credentials; do not disclose whether an account exists.
- On successful login, create a secure session and route the user to their permitted start page. Keep the session across a normal refresh. Provide visible logout, revoke the current session on logout, and end expired or revoked sessions.
- Owner can deactivate a staff account and revoke its active sessions. A deactivated user cannot log in or continue writing, while historical records retain that user's identity.
- Support password reset through a short-lived, single-use link or an owner-initiated reset. Reset invalidates prior sessions. Rate-limit repeated login and reset attempts.
- Enforce owner/cashier/service permissions on the server for every read and write, including direct links, exports, payment documents, and cost/profit fields.

## 4. Scope

### MVP

1. Business settings and users.
2. Unit intake, preparation status, stock list, and unit sale.
3. Customer service jobs and service payments.
4. Operating expenses, other income, and loss cases.
5. Payment entries and a cash ledger.
6. Dashboard, date-range profit and loss, monthly summary, and transaction lists.
7. Audit trail, correction/void flow, and initial workbook import with validation.

### Later phases

Barcode/QR scanning, supplier directories, spare-part stock purchasing/depletion, multiple branches, tax accounting, accounting-system integration, automated payment reminders, and advanced return/refund workflows. The workbook mentions spare-part codes and stock but contains no dedicated `Stok Part` or `Pembelian Part` sheet. Do not assume those processes are fully defined.

## 5. Core workflows and requirements

### 5.1 Business setup

- Capture store name, reporting year preference, currency IDR, and opening cash balance with an effective date.
- Date-range filters drive reports; changing the preferred year must not change historical transactions.
- Show opening cash as a ledger entry, not a hidden figure added to every query.

### 5.2 Unit intake and inventory

- Record one physical laptop or phone per unique `kode_unit`, with intake date, category (`Laptop` or `HP`), model, specifications, supplier/seller, purchase price, repair cost for the store-owned unit, other capital cost, target sale price, preparation status, and notes.
- Calculate **total unit cost = purchase price + store-owned repair cost + other capital cost**. All three inputs must be nonnegative IDR amounts.
- Preparation statuses: `Belum dikerjakan`, `Dalam perbaikan`, `Menunggu sparepart`, `Minus / rusak`, `Siap dijual`, `Retur`. The stock list is a derived view with `READY`, `DALAM PROSES`, `TERJUAL`, or `RETUR`; users edit the source unit or record a sale, never the derived stock status.
- A valid sale changes the unit's effective stock status to `TERJUAL` atomically. A returned purchase (`Retur`) is excluded from sellable stock and available inventory value. The app must block a second active sale for the same unit.
- Unit detail shows linked sale date, buyer, actual net selling price, gross profit, and margin after sale.

### 5.3 Unit sale

- Capture sale date, unique transaction ID, selected unit, selling price, discount, sale-specific cost, selected customer/buyer, initial payment, and notes. Each payment has its own method.
- Auto-fill unit model, category, and total unit cost from inventory. Selection lists only `Siap dijual` units; server validation repeats the check at save time.
- Calculate **net sales = selling price − discount**, **unit gross profit = net sales − unit cost − sale-specific cost**, and **margin = unit gross profit / net sales** when net sales is greater than zero.
- Require nonnegative amounts, discount no greater than selling price, and payment no greater than the amount due unless an explicit overpayment/refund workflow exists.
- Payment status is derived from all linked payments: `Belum Bayar` (zero), `DP` (partly paid), or `Lunas` (fully paid). Permit later installments without changing the original revenue amount.
- Link a sale with any unpaid balance or DP to a customer profile. A fully paid walk-in sale may omit the profile, while preserving the buyer name printed on the invoice.

### 5.4 Customer service

- Capture intake date, unique service ID, linked customer, device category/model, complaint, optional manually entered part code, part unit cost, part quantity, part charge to customer, labor/service charge, optional price estimate before completion, work status, payments, and notes.
- Work statuses: `Diterima`, `Dalam pengerjaan`, `Menunggu sparepart`, `Selesai`, `Batal`. Do not recognize a cancelled job as completed service revenue unless a separately recorded charge exists.
- Calculate **part cost = part unit cost × quantity**, **final invoice total = part charge + labor/service charge**, and after completion **remaining = final invoice total − payments**. Before completion, show any receipt as a deposit against the estimate, without a finalized payment status.
- For MVP, part cost and quantity are manual inputs and do not decrement a part inventory. Store-owned unit repair cost belongs in unit intake, not in a customer service job or operating expense.
- Service margin requires a product decision on technician cost versus customer labor charge (see Section 11). Until resolved, display invoice total and part cost; do not publish an ambiguous service profit figure.

### 5.4a Customer and DP tracking

- Create or select a customer when opening a service job or a sale with DP/unpaid balance. Store customer name, normalized phone/contact, optional alternate contact, and notes. Search by name or phone and show likely matches; staff must choose whether to reuse a profile. Do not silently merge customers based on a shared phone number.
- Require at least one contact method for a customer with a DP or unpaid balance. The internal customer ID remains the stable link even if their phone changes.
- The customer profile shows linked unit sales and service jobs, work status, invoice/estimate, deposit and installment history, payment documents, total paid, remaining per transaction, optional due date, and last payment date. Show a combined outstanding total that sums only finalized unpaid invoices; show service advances on unfinished jobs separately as `Uang muka diterima`.
- A DP taken before service completion requires an agreed estimate recorded on the job. Record the receipt against that job and customer immediately. Show it as a deposit, not earned revenue or a finalized `Lunas` status. On completion, issue the final invoice and apply the existing deposit to its balance. If the final invoice is less than the deposit, flag the excess for owner review/refund.
- Before completion, do not accept a deposit above the recorded estimate without an owner-approved correction to the estimate.
- Each later installment reduces only its linked transaction balance and gets its own numbered payment document. Staff can filter a customer list by `Ada DP`, `Belum Bayar`, `Lunas`, and service work status. Manual follow-up notes are allowed; automatic messaging is outside MVP.
- Customer contact details are visible only to roles that need them. Invoice and payment documents retain the customer details at issue time even if the profile changes later.

### 5.5 Operating expenses, other income, and losses

- Expense: date, transaction ID, category, description, amount due, payments, method, notes. Categories from workbook: electricity, internet, rent, transport, salary, administration, marketing, supplies, other.
- Other income: date, transaction ID, category, description, amount earned, receipts, method, notes. Categories: commission, other sales, other income.
- Loss case: date, case number, customer, loss type, chronology, replacement item/part code, quantity and unit cost or manual cost, additional cost, cash paid, responsible person, resolution status, notes. Calculate **total loss = (quantity × part unit cost when a part is specified, otherwise manual cost) + additional cost**.
- Loss types and resolution statuses follow the workbook's lists. A loss case is not itself a payment: its paid amount produces a separate cash movement. Prevent the same part replacement cost from being posted to both service cost and loss without an explicit linked adjustment.

### 5.6 Payments and cash

- Record each receipt or disbursement as an append-only payment entry linked to its source transaction, with payment date, amount, method (`Cash`, `Transfer`, `QRIS`), reference, and actor.
- Calculate balances from the payment entries, so later installments appear in the month actually received or paid. Revenue and expense recognition use the transaction's business date; cash reports use payment dates.
- Show opening cash plus receipts minus disbursements as closing cash. The MVP cash ledger must include payments for unit purchases and unit repair/capital costs, service part or technician payouts where actually paid, operating expenses, losses, and any refunds. A capital purchase does not become a profit-and-loss expense merely because cash left the store.
- Reconcile each source transaction's paid and remaining amounts to linked payment entries. Support correction/void entries with reasons instead of silently deleting posted cash history.

### 5.6a Invoices and payment documents

- Issue one numbered transaction invoice for each posted unit sale and each completed, chargeable service job. The transaction invoice shows the full amount due; installments do not create additional charges.
- **Every posted payment**, including an installment, supplier/expense payout, refund, or reversal, generates one unique numbered payment document. For money received from a customer, label it `Kuitansi pembayaran` and include the parent invoice number when available. For money paid out, label it `Bukti pembayaran`; a reversal gets a correction/void notice. These are the requested invoice/receipt documents for each payment, not duplicate sales or service invoices.
- The payment document shows store name, document number, issue and payment dates, source transaction, payer/payee, payment method/reference, amount paid in this payment, cumulative valid payments, remaining balance, and issuing staff member. Advance service receipts show the service job ID and `Uang muka`; link them to the final invoice after completion.
- Customer-facing documents show the customer name and relevant contact details from the issued snapshot. Payment history on the customer profile opens each receipt without exposing another customer's documents.
- Create the numbered document record with the payment atomically. Make its print/PDF view available immediately or show a retryable generation state without creating another payment. Staff can open, download, or print it from the payment history. A corrected payment retains the original document and adds a linked correction document.
- Document numbers are unique per store and type, and issued document snapshots do not silently change when customer or transaction details are edited later.

### 5.7 Reporting

- Dashboard filters by year or custom date range. Show net unit sales, service revenue, other income, total revenue, unit cost of goods sold, direct service costs, gross profit, operating expenses, losses, net profit, cash balance, unpaid balances, unit stock by status, available inventory value, and service jobs by status.
- Profit and loss uses the same definitions as the dashboard: **revenue = net unit sales + recognized service revenue + other income**; **gross profit = revenue − sold unit cost − sale-specific costs − direct service costs**; **net profit = gross profit − operating expenses − losses**. Unsold unit purchase cost remains inventory value.
- Monthly summary shows each component above plus cash in/out and closing balance. Inventory value is a **month-end snapshot**, calculated from units acquired and unsold as of that date, not today's stock copied into every month.
- Clicking a figure opens the contributing transaction list. Export filtered reports to CSV in MVP; printable PDF can follow.
- Labels must distinguish **revenue**, **cash received**, **profit**, and **inventory capital**.
- Show outstanding customer balances by customer and transaction; keep unfinished service deposits separate from finalized receivables so totals do not imply a completed invoice.

### 5.8 Audit and corrections

- Every creation, edit, status change, payment, and void stores actor, timestamp, entity/ID, field, old value, new value, and reason when correcting a posted record.
- Owner can review and mark a correction `Diperiksa` or `Selesai`. Audit history is immutable to ordinary users.
- A correction to a sale or payment recalculates linked stock, balances, dashboard, and reports. Financial history remains explainable through audit records.

## 6. Screens

| Screen | Key actions and information |
| --- | --- |
| Login / account | Sign in, password reset, logout, and owner-managed staff invitations/deactivation. |
| Dashboard | Period filter, financial cards, stock/service counts, unpaid alerts, links to source lists. |
| Units / Stock | Search by code/model/status, intake form, cost and preparation status, unit history. |
| New sale / Sales | Ready-unit picker, pricing and payment, transaction list, balance collection. |
| Customers | Search/create customer, view linked sales and service jobs, DP and installment timeline, outstanding balances, and manual follow-up notes. |
| Service jobs | Job intake, work queue by status, costs/charges, payment collection. |
| Finance | Expenses, other income, losses, cash ledger, outstanding balances. |
| Reports | Profit and loss, monthly summary, drill-down and export. |
| Settings / Audit | Store setup, user roles, import review, corrections. |
| Invoices / payment documents | View the parent sale/service invoice and every linked payment document; print or download PDF. |

## 7. Data model

Core records: `Store`, `User`, `AuthSession`, `AuthToken`, `Customer`, `CustomerNote`, `Unit`, `PurchaseReturn`, `UnitSale`, `ServiceJob`, `OperatingExpense`, `OtherIncome`, `LossCase`, `Payment`, `Invoice`, `PaymentDocument`, `OpeningBalance`, `Correction`, and `AuditEvent`. Every business record has a stable internal ID, store ID, created/updated timestamps, and creator. Human-readable unit, sale, service, expense, income, and case codes have store-level uniqueness constraints. One unit can have at most one active sale. `Payment` links to exactly one payable/receivable source and has one issued payment document. Customer balances are derived from linked sales, jobs, invoices, and payments. Derived statuses and totals are computed from the source records and linked payments rather than stored as independent editable values. The field-level model and constraints are in [ERD.md](ERD.md).

## 8. Import and migration

1. Offer a preview that maps workbook sheets and columns to the records above. Ignore prefilled blank formula rows and report-only sheets.
2. Reject or quarantine duplicate codes, unknown unit references, invalid dates, negative amounts, and sales of non-ready units. Show row-level errors before commit.
3. Import transaction sheets in dependency order: settings, units, customer profiles, sales, service, expenses, other income, and losses. Suggest customer matches by normalized phone and name, but require review before merging ambiguous records. Import prior paid amounts as dated opening payment entries only after confirming their actual payment dates; a single amount field cannot establish when installments occurred.
4. Preserve original workbook row, sheet, and external ID in import metadata for traceability. Never overwrite existing records silently on repeat import.
5. The supplied workbook has no entered business transactions, so it can seed field mappings and categories but cannot validate migration of real historical data.

## 9. Nonfunctional requirements

- Responsive web UI usable on a desktop counter and phone.
- Indonesian labels and IDR formatting; store monetary values as integer rupiah or fixed decimal, never binary floating point.
- Server-side validation and database constraints for unique IDs, legal status transitions, and nonnegative amounts. A sale save and inventory state change are one atomic operation.
- Role-based authorization on both UI and API. Protect customer phone numbers and financial data; record access to financial corrections.
- Secure password storage, session revocation, rate limiting on authentication endpoints, and no credentials in logs or exported documents.
- Search/filter/sort and pagination for transaction lists; no 500-row limit from the spreadsheet.
- Daily backup and documented restore procedure. Use transaction timestamps to make reports reproducible.
- Apply the component behavior, accessibility states, responsive checks, and restrained motion rules in [DESIGN_REVIEW.md](DESIGN_REVIEW.md) to every implemented screen.

## 10. MVP acceptance scenarios

1. Owner creates unit `U-001` with purchase 2,000,000, repair 200,000, and additional capital 50,000. Total cost becomes 2,250,000; stock is `DALAM PROSES` until marked `Siap dijual`.
2. Cashier sells `U-001` for 3,000,000 with 100,000 discount and 50,000 sale cost. Net sales is 2,900,000, gross profit is 600,000, unit stock becomes `TERJUAL`, and a second sale is rejected.
3. Customer pays 1,000,000 at sale and 1,900,000 next month. Sale revenue stays in the first month; cash receipts appear in their respective payment months; status moves from `DP` to `Lunas`.
4. A 500,000 unsold unit purchase reduces cash when paid and increases inventory, but does not reduce profit until sale or an approved loss/adjustment.
5. A service job with part cost 100,000, part charge 150,000, and service charge 200,000 has a 350,000 invoice and 250,000 margin **only if** no additional technician cost is recorded under the chosen policy.
6. A report for the same date range gives identical net profit on dashboard, profit and loss, and summed monthly rows. A prior month-end inventory snapshot does not change merely because a unit sells later.
7. Correcting a posted transaction requires a reason, creates an audit event, and updates affected balances and reports.
8. A cashier logs in and can create a sale but cannot open owner-only profit or audit data by entering its URL. Deactivation immediately ends that cashier's active sessions.
9. A sale paid in two installments has one sale invoice and two uniquely numbered payment documents, each showing its installment amount and the updated remaining balance. Printing a document again does not create another payment.
10. Staff open a customer's profile and see an unfinished service job with a 100,000 DP as `Uang muka diterima`. After a 350,000 final invoice, the same profile shows 100,000 paid and 250,000 outstanding; a later 250,000 payment changes that job to `Lunas` and adds a second receipt.

## 11. Decisions needed before build

| Decision | Why it matters | Proposed default |
| --- | --- | --- |
| Is `Harga Jasa Teknisi` customer revenue or technician cost? | The service sheet adds it to the customer invoice and margin, while profit and loss subtracts it as a direct cost. | Treat it as a customer charge; add a separate `Biaya Teknisi` field for actual payout. |
| When is service revenue recognized? | The workbook sums by intake date even when work is unfinished or cancelled. | Recognize on completion date; retain cash receipts on payment dates. |
| What is the opening cash effective date and which accounts count as cash? | The workbook has one opening balance and combines Cash, Transfer, and QRIS. | One opening balance at migration date; report combined available funds, with method breakdown. |
| Are returns/refunds required in MVP? | The workbook has `Retur` status and loss types but no complete reversal/payment flow. | Support purchase return before sale; defer customer sale return/refund until a documented workflow is approved. |
| Will spare parts have tracked stock? | Spare-part references appear, but there are no corresponding purchase or stock sheets. | Manual service part cost in MVP; tracked spare-part inventory later. |

## 12. Workbook mapping and cautions

| Workbook sheet | App destination |
| --- | --- |
| `Pengaturan` | Store settings and opening cash entry. |
| `Pembelian Unit` | Unit intake and cost basis. |
| `Stok Barang` | Derived unit stock view. |
| `Penjualan Unit` | Sales and sale payments. |
| `Servis` | Service jobs and payments. |
| `Kerugian` | Loss cases and payments. |
| `Biaya Operasional` | Expenses and disbursements. |
| `Pendapatan Lain` | Other income and receipts. |
| `Dashboard`, `Laba Rugi`, `Rekap Bulanan` | Reports calculated from one shared set of rules. |
| `Log Koreksi` | Immutable audit events and correction review. |
| `Petunjuk` | Workflow reference, not an app data table. |

Workbook issues to resolve in implementation: its cash-out formula omits unit purchases; its monthly inventory formula uses current stock for every month; its service work-status validation points to column W although the displayed status is column Q; its correction-log dropdown names `Biaya Unit`, `Stok Part`, and `Pembelian Part`, which are not present as sheets. These are source-template observations, not requirements to reproduce those errors.
