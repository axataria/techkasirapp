# Design reference review and app component specification

**Product:** Laptop and phone store management app  
**Companion:** [PRD.md](PRD.md)  
**Reference:** `DESIGN (1).md` (Notion style reference supplied by the user)  
**Review scope:** All 14 named reference components plus the operational components needed by the PRD. This workspace contains a PRD, but no app UI code or rendered screens yet. The table therefore reviews component *fit and intended adaptation*, not an implemented interface.

## Design direction

Use the reference's warm paper canvas, white surfaces, hairline borders, restrained blue primary action, and calm typography. This is a working store app: cashiers repeat entries frequently, owners scan financial figures, and service staff update jobs. Prioritize readable amounts, fast data entry, clear status, and error prevention. Marketing-only elements should not consume space in daily workflows.

The attached reference is design input, not an instruction to copy its marketing layout, product claims, character illustrations, or example CSS literally. In particular, its quick-start example gives a pill radius to the primary button while its component definition says 8px; use 8px for app buttons. Its type scale reaches 96px for a hero; app page headings use 24px and below.

## Review of every reference component

| Before (reference component) | After (app component) | Why |
| --- | --- | --- |
| Primary CTA Button: filled blue conversion button | **Primary action button:** blue `#0075de`, white label, 8px radius; one main action per view such as `Simpan unit` or `Catat penjualan` | Keeps the reference's focus while giving each task a clear next step. |
| Ghost CTA Button: blue tinted alternative | **Secondary button:** pale blue `#e6f3fe`, blue label for actions such as `Tambah pembayaran` | Separates the next useful action from the form's primary save. |
| Ghost Text Button: low emphasis text action | **Tertiary button:** transparent for `Batal`, `Lihat detail`, and filter reset | Avoids competing filled buttons. |
| Outlined Text Button: compact inline link | **Outlined utility button:** `Ekspor CSV`, `Ubah filter`, and similar bounded actions | Gives tools a visible hit area without primary emphasis. |
| Muted Nav Link: subdued navigation | **Sidebar or top navigation item:** readable inactive text, current page indicator, visible keyboard focus | The reference's 54% black may be too faint for small app labels; selected state must remain clear without hover. |
| Pill Tag: colored category/status label | **Semantic status badge:** text plus color for `Siap dijual`, `Terjual`, `DP`, `Lunas`, `Menunggu sparepart`, and `Batal` | Status must communicate meaning even without color and remain consistent across screens. |
| White Feature Card: bordered white card | **Summary or form card:** white, 12px radius, 1px neutral border, no shadow | Provides the primary app surface and supports scanning. |
| Accent Feature Card: saturated promotional panel | **Limited attention card:** a pale tint for a single operational warning or next action; avoid saturated blocks around financial figures | Dense dashboards need stable visual hierarchy; bright feature panels would compete with important values. |
| Dark Feature Card: midnight promotional block | **Optional focused summary panel:** reserve for one high-level cash or net-profit callout if it passes contrast checks | A dark island can anchor one number but should not obscure comparison among metrics. |
| Hero Highlight Pill: colored word in headline | **No routine app equivalent**; reserve for a future public marketing page | Decorative headline treatment slows reading in transaction screens. |
| Avatar Character Mark: illustrated decorative face | **User initials/avatar only when identity matters** in audit or account menu; no decorative characters | Staff identity is useful; illustrations do not help record sales or service. |
| Kanban Task Card: mockup task item | **Service job card on narrow screens**, with ID, customer, device, status, and due/received date; desktop uses a table | The card pattern can support the service queue if it carries actionable data. |
| Section Header: 48–54px marketing heading | **Page heading:** 24px; section heading: 20px; card heading: 16px | Keeps forms and transaction lists above the fold. |
| Logo Wall Item: partner/client logo | **No operational equivalent** | The app has no supported partner logos and no reason to display a logo wall. |

## Foundation tokens for implementation

| Token | Value | Use |
| --- | --- | --- |
| `surface.canvas` | `#f6f5f4` | App background. |
| `surface.card` | `#ffffff` | Cards, form sections, table surface, dialogs. |
| `text.primary` | `#111111` | Main text and amounts. |
| `text.secondary` | `#615d59` | Supporting labels and helper text. |
| `border.default` | `rgba(0,0,0,0.08)` | Full card/table borders; stronger border for focused controls. |
| `action.primary` | `#0075de` | Main action and active navigation accent. |
| `action.secondary` | `#e6f3fe` | Secondary button surface. |
| `status.success`, `status.warning`, `status.danger` | Define accessible foreground/background pairs in implementation | Semantic states only; do not reuse decorative coral or yellow without a contrast check. |
| `radius.card`, `radius.control`, `radius.pill` | 12px, 8px, full | Main shape system. |
| `space` | 4, 8, 12, 16, 24, 32, 48px | Reusable spacing steps; denser within tables, generous between sections. |
| `font.ui` | Geist or a similarly legible sans with local/system fallback | One typeface for transaction UI. The reference's NotionInter and Lyon Text are stylistic cues, not assumed licensed assets. |

Use 24px/32px for page headings, 20px/28px for section headings, 16px/24px for body and input labels, and 14px/20px for secondary information. Amounts use tabular numerals and right alignment in columns. Use `Rp` formatting with Indonesian grouping, but store numeric values separately. Do not rely on opacity alone for important status, disabled text, or validation messages. Keep paragraph copy in sentence case and focused on the task.

## App component inventory and required states

| Component | Required behavior | States to design and verify |
| --- | --- | --- |
| App navigation | Current page visible, role-aware items, predictable return path; collapses to a menu on narrow screens | Default, selected, hover where supported, keyboard focus, disabled/hidden by permission |
| Login form | Identifier and password, visible labels, password reveal, reset link, generic credential error, and clear submit state | Empty, invalid, rate-limited, submitting, expired session, deactivated account |
| Staff access panel | Owner invites, changes roles, deactivates users, and sees the effect on active sessions | Pending invite, active, deactivated, expired invite, reset requested |
| Button set | One primary action per task area; labels name the action; pressing gives subtle feedback | Default, hover, active, focus, disabled, submitting |
| Form field | Persistent label, format hint where needed, inline error beside field | Empty, filled, focus, invalid, disabled, saving |
| Currency input | IDR display, numeric value, rejects negative or excessive payment, handles pasted separators | Empty versus zero, invalid amount, focus, read-only calculated value |
| Date input/range | Locale-readable dates, clear start/end, inclusive report boundary | Empty, valid, reversed range, future/closed period if disallowed |
| Unit picker | Search by unique code/model; show only sellable units and enough context to avoid a wrong sale | Loading, no match, selected, already sold race, invalid/withdrawn unit |
| Customer picker | Search by name or phone, show likely matches with enough context, allow explicit new profile | No match, similar names, shared phone, selected, missing contact for DP |
| Customer profile | Linked sales and service jobs, payment timeline, documents, finalized outstanding total, separate unfinished-service deposits, follow-up notes | No history, DP, overdue, settled, cancelled, conflicting customer match |
| Status select | Only legal workflow transitions; status and reason shown before irreversible transitions | Available, blocked transition, selected, save pending, conflict |
| Transaction table | Search/filter/sort, clear column headers, row action, right-aligned numbers, stable IDs | Loading skeleton, empty, no search result, error, paginated, selected row |
| KPI card | One metric, period, unit, and drill-down target; distinguish balance from flow | Value, zero, negative, unavailable data, loading |
| Status badge | Label always present; color only reinforces meaning | Ready, in process, sold, returned, unpaid, partial, paid, cancelled |
| Payment panel | Amount due or agreed estimate, paid, remaining, payment history, new payment action | Zero paid, unfinished-service deposit, partial, settled, overpayment rejection, correction |
| Invoice and payment document view | One source invoice plus numbered receipt/voucher for every payment; show payment amount and balance clearly; print/download from history | Advance before invoice, partial, paid, PDF generating, PDF failed/retry, corrected/voided |
| Service job card | Customer/device summary and clear next action on mobile | Each work status, missing phone, long model/name, cancelled |
| Confirmation dialog | Names record and consequence for void or correction; reason field when required | Open, validation error, pending, success, failed save |
| Toast/inline feedback | Specific calm message and useful next step; never the sole place to show a form error | Success, failure, retry, timeout |
| Import preview | Map columns, show accepted/rejected counts and row-level issues before commit | No file, parsing, duplicate codes, invalid rows, ready to import, complete |
| Audit event | Actor, timestamp, entity, old/new values, reason, review state | Long values, missing prior value, pending review, reviewed |
| Empty state | Explain why the list is empty and offer the relevant first action | Truly empty versus filtered empty versus no permission |

All interactive controls need visible focus and a minimum comfortable touch target. A screen at 390px must have no page-level horizontal overflow. Dense tables can scroll within a clearly bounded region or turn into cards with the important columns preserved. Do not truncate unique codes or currency values without a way to reveal the full value. Forms must preserve entered values and explain a failed save. User-visible UI copy should be Indonesian.

## Motion specification

Follow the design engineering decision order: decide whether motion helps, identify its purpose, then set properties, curve, duration, and interruption behavior. This app has frequent keyboard and data-entry actions, so keyboard shortcuts, table navigation, filter changes, calculated values, and financial figures update immediately without entrance motion. Motion is suitable for occasional dialogs, drawers, and transient feedback.

| Interaction | Motion |
| --- | --- |
| Button press | `transform: scale(0.97)` for about 120–160ms; disabled under reduced motion if needed. |
| Popover/dropdown | Opacity plus slight scale from `0.97`, origin at trigger; 150–200ms strong ease-out; closes faster. |
| Dialog/drawer | Opacity plus small transform, 200–250ms strong ease-out; interruptible. Modal origin remains center. |
| Toast | Opacity/transform, short and interruptible; pause dismissal timer while tab is hidden. |
| Data rows, report values, keyboard action | No stagger, bounce, or scroll reveal. Update in place. |

Animate transform and opacity; avoid `transition: all`, `scale(0)` entrances, and animation of financial values. Gate hover effects to hover-capable fine pointers. Under `prefers-reduced-motion`, remove movement while preserving immediate state clarity. Repeated tooltips in a toolbar should appear instantly after the first is open.

## Component review acceptance

Before approving a visual implementation, check every component above on desktop and a 390px viewport. Verify keyboard navigation, visible focus, full labels, realistic long Indonesian names/models, empty and zero data, negative profit, partial payment, duplicate unit code, conflicting sale, failed save, and reduced motion. Check login, expired sessions, role-restricted documents, and installment document history. Verify that dashboard figures and table values remain readable at the store counter and that the primary action remains visible without competing promotional content.
