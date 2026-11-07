# TechKasir break-ui audit

The findings below describe the pre-repair audit. All nine were subsequently repaired. See [FIXES.md](FIXES.md) for implementation decisions and verification. limits.json was refreshed during the repair run.

Audit date November 7, 2026, Asia/Jakarta.

Only development QA fixtures, harnesses, screenshots, and this report were added. Product components were not repaired during this audit.

## Scope and evidence

- The audit renders the current files under public through an isolated local server at [QA comparison page](http://127.0.0.1:3101/?data=worst).
- The database is qa/break-ui/isolated-data/store.db. The harness does not connect to data/store.db. Browser requests go to ports 3101 and 3102.
- Headless Microsoft Edge ran 160 recorded layout/screenshot states. Additional interaction checks bring the screenshot count to 186.
- Worst-case screens covered dashboard, customers, stock, sales, services, payments, finance, reports, settings, audit log, and staff at 320, 390, 768, and 1440 CSS pixels.
- All nine palettes ran on the dashboard in both modes at all four widths. Other screens used the worst-case fixture at every width, with additional light/dark modal samples. A representative overview is in [theme-contact.png](theme-contact.png).
- Separate Demo data, Worst case, Empty, One, and 1,000 rows fixtures enter through mocked API responses. Mutating tests use the real API against the isolated database.
- Controls at the bottom of the QA page persist fixture selection in its URL. They exist only in the QA server, not the normal app.
- [results.json](results.json) contains layout measurements, state names, screenshot paths, and currency line counts. [interactions.json](interactions.json), [details.json](details.json), [additional.json](additional.json), and [limits.json](limits.json) hold interaction and boundary results.
- [surface-fields.json](surface-fields.json) maps 200 endpoint/field entries, including nested report months, payment snapshots, customer transactions, sources, types, limits, and optionality. Limits marked context-dependent need the schema as the authority.

### Coverage limits

Google Fonts requests failed with ERR_NETWORK_ACCESS_DENIED in this browser environment. CSS.getPlatformFontsForNode confirmed Segoe UI was actually rendered. Layout results therefore apply to the shipped fallback font. Plus Jakarta Sans needs an additional pass where the font can load.

The 200% case uses a 720 × 450 CSS viewport at device scale factor 2, producing a 1440 × 900 image. It exercises equivalent reflow and scaling. The browser chrome zoom command itself was not exercised. Mobile checks emulate viewport widths in headless desktop Edge and are not physical-device tests. RTL layout was not included because the product is currently Indonesian LTR. RTL names were included as data.

No formal pixel-based contrast certification or frame-rate benchmark was performed. Source inferences are labeled below and separated from browser/API observations.

## What broke

| # | Severity | Component / field | Worst case | Observed failure | Recommended fix |
| --- | --- | --- | --- | --- | --- |
| 1 | Broken | Financial aggregates / inventoryValue | Accepted input 9,007,199,254,740,991 plus an existing 1,000,000 | API returns 9,007,199,255,740,992 instead of 9,007,199,255,740,991 | Bound amounts to a justified business range and validate sums/products, or use exact integer arithmetic end to end. See server.mjs lines 43 and 119. |
| 2 | Broken | Unit selection dropdown | 101 options including 100 long unit labels, with differing suffixes | At 320 px, the popup extends beyond the visible edge and the identifying suffix/model is hidden. Different choices look identical | Keep native keyboard behavior, use a concise distinct unit code plus short model, and show the full selected unit details beneath the control. See public/app.js line 310. |
| 3 | Ugly | Dashboard and report currency values | Rp 9.876.543.210.987 and negative Rp 987.654.321.098 | Digits split between lines, including a lone trailing digit at narrow widths | Put monetary KPIs in a single column when necessary and reserve sufficient width for the complete amount. Remove arbitrary breaks inside the number. See public/style.css lines 516 and 1450. |
| 4 | Ugly | Sticky modal actions | New unit and sales forms at 320/390 px and 200% equivalent | Footer extends below the visible dialog edge. Buttons are partially cut off before scrolling to the bottom | Use bottom 0 and explicit footer padding within a bounded scrolling dialog body. See public/style.css line 841. |
| 5 | Broken | Date input versus report year selection | 1970-01-01 and 2000-01-01 | A 1970 transaction date is accepted, but its report year returns 400. UI year choices only expose 2022–2028 in this run, omitting 2000 | Align date/report business ranges and expose years present in saved transactions. See server.mjs lines 44 and 180, public/app.js line 260. |
| 6 | Ugly | Table transaction dates and identifiers | 2026-11-07 alongside a long invoice code and descriptions | Dates split as 2026-11- / 07. Dense rows become much harder to scan | Keep dates and financial values on one line, permit names/descriptions to wrap, and provide horizontal scrolling for the table. See public/style.css lines 553 and 644. |
| 7 | Ugly | Account avatar fallback | 👩🏽‍💻 Putri | The avatar displays only 👩, losing the skin-tone modifier and laptop sequence | Segment the first grapheme with Intl.Segmenter, then derive initials or show the complete grapheme. See public/app.js line 108. |
| 8 | Fragile | User-entered text limits | 64-character personal name, 156-character option, approximately 2,000-character description | Most text fields have no per-field upper bound. Longer accepted values can further enlarge tables and dropdowns | Define field-specific limits shared by frontend/API, with backward-compatible rendering of existing longer values. See server.mjs lines 18–22 and 45, public/app.js line 63. |
| 9 | Fragile | Mobile revenue chart keyboard access | Twelve monthly columns at 320 px | Columns remain focusable, but the mobile rule hides every tooltip even when focus-visible is true | Provide selected-month details that work by touch and keyboard, or remove empty tab stops and expose an accessible monthly data summary. See public/style.css line 1555 and public/app.js chart markup. |

### 1. Financial aggregate precision

**Verification** — API-verified against the isolated real database. Not inferred from a screenshot.

**Reproduction** — Submit a unit with purchaseAmount 9007199254740991, repairAmount 0, and extraAmount 0. This is accepted with 201. Read the dashboard while another unsold unit has a cost of 1000000.

**Expected** — Exact inventory value 9007199255740991, or rejection before storing a value the application cannot aggregate safely.

**Actual** — inventoryValue is 9007199255740992. The endpoint returns 200, so the wrong amount looks successful.

**Cause** — Individual inputs use Number.isSafeInteger. Later Number additions can exceed the safe integer range. Input validation does not guarantee safe derived totals.

**Opinion** — A store app should adopt a realistic monetary maximum and checked arithmetic. If very large balances are a genuine requirement, use an exact integer representation for storage, calculations, transport, and display. A smaller font or display rounding cannot repair this defect.

**Evidence** — [limits.json](limits.json), including the exact BigInt comparison. The temporary maximum-value unit was removed from the isolated database after the check.

### 2. Indistinguishable unit options

**Verification** — Visually verified in Edge with 101 native options.

**Reproduction** — Choose 1,000 rows on the QA route, open Penjualan, choose Catat penjualan, and expand Unit siap jual at 320 px.

**Expected** — The user can distinguish available units before committing a sale.

**Actual** — Options share the visible prefix INV/JKT/TECHKASIR/REKONDISI/COR…. Their differing suffixes and model details run off the visible right edge.

**Cause** — Full unbounded code and model strings are combined into a single unwrapped native option.

**Opinion** — Use a compact, stable, distinct visible label and a full-value preview after selection. If inventory volumes require searchable selection, use a proven accessible combobox rather than an improvised menu. Do not solve this by truncating all options to the same prefix.

**Evidence** — [many-long-options-320.png](screenshots/many-long-options-320.png), [long-unit-dropdown-320.png](screenshots/long-unit-dropdown-320.png).

### 3. Currency fragments on narrow screens

**Verification** — Visually verified in light and dark modes. Currency line counts are also recorded in results.json.

**Reproduction** — Use Worst case at 320 or 390 px and inspect dashboard KPIs and report totals.

**Expected** — Every complete amount remains readable as one number.

**Actual** — Rp 9.876.543.210.987 breaks through its digit groups. A trailing 8 or 87 can appear alone on the last line.

**Cause** — A fixed two-column KPI arrangement combined with overflow-wrap:anywhere on monetary values.

**Opinion** — Let card layout yield before monetary precision. Switch to a single column based on available card width and keep numeric text intact. Never use ellipsis or compact notation for these financial totals.

**Evidence** — [initial-worst-390.png](screenshots/initial-worst-390.png), [worst-reports-320.png](screenshots/worst-reports-320.png), [theme-dark-cobalt-320.png](screenshots/theme-dark-cobalt-320.png).

### 4. Partly clipped modal actions

**Verification** — Visually and geometrically verified.

**Reproduction** — At 320 px, open Tambah unit with a long model value. Inspect the initial viewport before scrolling the dialog. Repeat the 200% equivalent case.

**Expected** — Both action buttons stay fully visible and tappable.

**Actual** — At a 950 px viewport height the footer rectangle ends at y=957, below the visible dialog edge. Scrolling to the bottom restores the full buttons.

**Cause** — The sticky footer uses bottom:-24px together with negative margins inside a padded scrolling dialog.

**Opinion** — Use a distinct bounded scrolling body and a stationary footer, or fix the sticky inset and padding together. Preserve complete 44 px hit targets.

**Evidence** — [unit-modal-top-320.png](screenshots/unit-modal-top-320.png), [unit-modal-bottom-320.png](screenshots/unit-modal-bottom-320.png), [zoom-200-equivalent-modal.png](screenshots/zoom-200-equivalent-modal.png).

### 5. Inconsistent date and report ranges

**Verification** — Browser-verified date field validity and year dropdown contents, plus API-verified date/report mismatch.

**Reproduction** — Enter 2000-01-01 in a transaction date field. It is valid. Open the report year selector, which only lists 2022 through 2028 in this run. Separately, a transaction with 1970-01-01 saves with 201, while GET /api/reports?year=1970 returns 400.

**Expected** — All admitted historical transaction dates have a report path.

**Actual** — UI and API ranges disagree with transaction validation.

**Cause** — The date validator checks calendar validity only. The reports API independently restricts years to 2000–2100. The UI independently creates seven years around the current host year.

**Opinion** — Drive report years from stored data and an explicit business policy. Retain a way to report legacy records when introducing new input limits.

**Evidence** — [limits.json](limits.json), the Historical date and Report years rows in [interactions.json](interactions.json).

### 6. Dates wrap in table rows

**Verification** — Visually verified.

**Reproduction** — At 320 px, open Worst case sales or service tables.

**Expected** — A transaction date stays intact while the table scrolls horizontally.

**Actual** — 2026-11-07 becomes a two-line value. Long descriptions also expand rows substantially.

**Cause** — Amount columns receive numeric/nowrap treatment, but date cells do not receive equivalent semantic styling.

**Opinion** — Give dates explicit nowrap/minimum width, wrap identity fields where necessary, and clamp descriptive previews only when the full description is available elsewhere.

**Evidence** — [worst-sales-320.png](screenshots/worst-sales-320.png), [worst-services-320.png](screenshots/worst-services-320.png).

### 7. Partial emoji avatar

**Verification** — Visually verified and matched to source.

**Reproduction** — Load Worst case and inspect the avatar for 👩🏽‍💻 Putri.

**Expected** — Either the complete first grapheme or deliberate initials.

**Actual** — Only the woman character appears.

**Cause** — Array.from separates code points, not grapheme clusters.

**Opinion** — Use Intl.Segmenter. The J fixture and long Indonesian name already have readable menu fallbacks and should keep working.

**Evidence** — [initial-worst-390.png](screenshots/initial-worst-390.png), [account-long-name-320.png](screenshots/account-long-name-320.png), [account-one-letter-320.png](screenshots/account-one-letter-320.png).

### 8. Unbounded text

**Verification** — Schema/source-verified fragility. The plausible long-name, long-code, Unicode, and description fixtures were rendered in the browser.

**Reproduction** — Send a long name, code, model, supplier, or description through the existing API. The required helper only checks non-empty trimmed text, and relevant SQLite TEXT columns have no length check.

**Expected** — A documented per-field contract plus resilient display.

**Actual** — Most fields are bounded only by the overall request-body ceiling.

**Cause** — Missing shared field-level validation.

**Opinion** — Start with meaningful product limits, not arbitrary short strings. Keep old records readable and show a character count near legitimate long-entry limits.

**Evidence** — [surface-fields.json](surface-fields.json), [fixtures.json](fixtures.json), and the schema at server.mjs lines 18–22.

### 9. Mobile chart empty tab stops

**Verification** — Browser keyboard focus was focus-visible, but the tooltip rectangle remained zero-sized. The mobile CSS explains it.

**Reproduction** — At 320 px, focus the first revenue column and press Tab to another month.

**Expected** — The focused month exposes its values or provides an intentional accessible alternative.

**Actual** — Month columns are still tab stops while .chart-tip is display:none !important below 560 px.

**Cause** — Tooltip removal and keyboard semantics were changed independently.

**Opinion** — Prefer one selected-month detail region that also responds to touch. The existing Detail link remains a route to monthly figures, so this is classified Fragile rather than loss of all report access.

**Evidence** — [additional.json](additional.json), [chart-keyboard-tooltip-320.png](screenshots/chart-keyboard-tooltip-320.png).

## Decisions and recommendations

- **Wrap versus truncate** — Wrap customer names in detail views. Use restrained wrapping or a short preview in tables, with the full value available in the account menu, customer history, or detail view. Keep dates and financial amounts complete. Show distinguishing code suffixes where long option labels share a prefix.
- **Pagination versus virtualization** — Keep pagination for the current tables. The 1,000-row fixture displays five live body rows, exposes 200 pages, and advances from 1–5 to 6–10 correctly. Consider server-side pagination if initial data volume becomes expensive. No observed failure here justifies adding virtualization now.
- **Glass versus readability** — Keep the moving backdrop and decorative glass. Inputs, menus, dialogs, and financial data deserve higher-opacity surfaces. The observed themes remained legible with the fallback font, but this audit is not a formal dynamic-contrast certification.
- **Native date picker** — Keep its keyboard and platform behavior. Its appearance and locale are controlled by the browser. Make accepted dates and report years consistent before considering a custom calendar.

## What held up

- No page-level horizontal overflow was measured in the 160 layout cases. Tables and mobile navigation intentionally scroll inside their own containers.
- The fixed sidebar gradient stays on the clipped surface. A collapsed surface computed inset(0px 150px 0px 0px), and its outer sidebar container had background-image:none.
- All nine color palettes rendered in both light and dark modes at the requested widths.
- Ambient movement changes transform under no-preference and stops under prefers-reduced-motion:reduce.
- Cancel produced zero writes for a valid completed customer form.
- Two submission attempts during a slow request produced one POST. Saving feedback appeared and Escape could not dismiss the pending form.
- Failed saves retained entered text, restored actions, and focused the inline error.
- Escape closed an idle dialog and restored focus to its trigger. Keyboard traversal did not reach actionable app controls behind the modal. One native focus cycle reached BODY/browser chrome before returning to the dialog.
- Search edits invalidated an older response. No-results and injected API-error states rendered without a fatal JavaScript exception.
- 1,000-row tables paginated correctly with five body rows and working next-page navigation.
- Long account names wrapped in the account menu. J had a usable avatar and menu. Missing optional phones showed a stable fallback.
- Literal HTML-like strings were displayed as text. No test payload executed.
- Native date picker opened successfully. Invalid calendar dates, negative monetary inputs, and values above the safe-integer input limit were rejected.
- Empty customer/unit dropdowns gave explanatory guidance.

## Priorities

The three highest-priority fixes are exact financial aggregate handling, distinguishable unit selection, and intact monetary values on mobile.

Three quick wins are correcting the footer's sticky inset, keeping date cells on one line, and replacing code-point avatar extraction with grapheme segmentation.

## Reproduce and review

Open [QA comparison page](http://127.0.0.1:3101/?data=worst) and choose Demo data, Worst case, Empty, One, or 1,000 rows at the bottom.

If the QA service has stopped, run node qa/break-ui/server.mjs. Browser runs are node qa/break-ui/run.mjs, node qa/break-ui/interactions.mjs, and node qa/break-ui/details.mjs. Run only one browser harness at a time because they share the QA Edge profile. The limits check is node qa/break-ui/limits.mjs and mutates only the explicitly isolated test database.

Say "fix all" or "fix 1, 3" to apply selected product fixes.
