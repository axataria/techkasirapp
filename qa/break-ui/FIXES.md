# TechKasir audit repairs

All nine findings from REPORT.md have been repaired.

## Changes

| Finding | Repair | Verification |
| --- | --- | --- |
| 1. Financial precision | Shared BigInt-backed arithmetic covers inventory, sales/service costs, cash, receivables, monthly reports, customer balances, formatting, and currency sorting. SQLite integer reads preserve large values. | domain.test.mjs checks the formerly incorrect total as exactly 9007199255740991, derived unit costs, large invoices, multiple payments, and service-cost multiplication. |
| 2. Unit dropdowns | Native choices use a short ordinal plus distinguishing code suffix. The full selected code and model appear in a wrapping detail panel. | 100 available choices plus the placeholder fit the narrow popup. Every actual choice label is distinct. Full details remain visible. |
| 3. Monetary layout | Container queries adjust KPI/report columns using available content width, including the expanded sidebar. Currency values remain intact. Extremely long values can scroll locally instead of losing digits. | All measured amounts in the 160-case fixture matrix occupy one line and fit their visible boxes. No page-level horizontal overflow was detected. |
| 4. Modal footer | The sticky inset is now zero. Dialog width has an explicit viewport bound. | Both action buttons fit inside the dialog at 320, 390, 768, and 1440 px. The 200% equivalent screenshot was recaptured. |
| 5. Historical reporting | Report years come from saved dates, the selected year, and the current WIB year. The API supports the four-digit years admitted by existing records. Low-year month generation no longer relies on Date.UTC's 1900 offset. | API checks cover 1970 and 0001. The browser can select and display 1970. Invalid calendar dates and year 10000 are rejected. |
| 6. Table dates | Enhanced tables identify ISO date/month cells and keep them on one line. | Mobile table date cells have nowrap styling and a single text line. |
| 7. Avatars | Initials use Intl.Segmenter graphemes. | The complete 👩🏽‍💻 sequence, J, and blank-name fallback are tested. |
| 8. Text contracts | New writes and HTML controls share field-specific text limits and reject non-text payloads. Login continues to accept existing credentials. Unchanged long service notes remain editable without forced truncation. | Tests cover over-limit names, preserved legacy notes, frontend code/model limits, and server validation. |
| 9. Chart access | Monthly columns are labeled native buttons. A visible selected-month region responds to clicks and keyboard focus, including mobile. | Browser checks verify January selection, February keyboard focus, exact displayed amounts, and pressed state. |

## Contract decisions

Normal-sized financial JSON values remain numbers. Totals beyond Number.MAX_SAFE_INTEGER are returned as exact decimal strings. The application and table sorting handle both representations. Consumers of these API fields should preserve those strings rather than convert them to floating-point numbers.

Input amounts retain their existing nonnegative safe-integer range. Derived values stored in SQLite are checked against its signed 64-bit integer range. There is no newly invented per-transaction business cap.

Text limits use the same UTF-16 length convention as HTML maxlength. Names allow 160, transaction codes 96, device models 240, store names/suppliers 200, phone numbers 40, usernames 80, passwords 256, notes/specifications/complaints/descriptions 4000, references 2000, and correction reasons 1000. Existing longer values remain readable, and unchanged legacy service notes/part codes can be submitted.

The glass surfaces, noise, glow, nine palettes, and slow ambient gradient remain available through the existing appearance system.

## Checks completed

- npm test passes integration, dashboard, search, component, table, and new domain regression checks.
- The expanded-sidebar browser matrix completed 160 cases covering the four requested widths, worst-case screens, Demo/Empty/One/1,000 rows, all nine dashboard palettes in light/dark mode, sidebar states, reduced motion, and 200% equivalent reflow.
- [fixed/results.json](fixed/results.json) records the measurements and screenshots.
- [fixed/verification.json](fixed/verification.json) records targeted repair assertions.
- [fixed/interactions.json](fixed/interactions.json) records the repeated interaction pass. Cancel, duplicate-submit prevention, failure recovery, search invalidation, pagination, and motion preferences still pass.
- No fatal JavaScript exceptions occurred during the targeted verification or repeated interaction run.
- The local application and isolated QA servers were restarted with the repaired backend. App bootstrap, the shared domain module, and the QA comparison page return HTTP 200.

The browser environment still blocks Google Fonts, so the screenshots use Segoe UI fallback. The 200% case is equivalent reflow/scaling, not the browser-menu zoom command. Physical mobile devices and formal pixel-based contrast certification remain outside this verification.

## Review

Open [the comparison page](http://127.0.0.1:3101/?data=worst) and select Demo data, Worst case, Empty, One, or 1,000 rows.

Examples of repaired components are [unit options](fixed/screenshots/verified-unit-options-320.png), [full unit details](fixed/screenshots/verified-unit-detail-320.png), [modal actions](fixed/screenshots/verified-modal-320.png), [table dates](fixed/screenshots/verified-table-dates-320.png), and [mobile chart details](fixed/screenshots/verified-chart-details-320.png).
