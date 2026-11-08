# TechKasir frontend

The active frontend is Next.js App Router + React + TypeScript. Components in `src/components/ui` were installed from the official shadcn/ui registry with the shadcn CLI, then adapted to TechKasir tokens, Phosphor icons, touch targets, and semantics.

- Glassmorphism: translucent full-border cards, sidebar, and header with backdrop blur. Dialogs and menus use opaque theme surfaces for readability. Reduced transparency fallback is provided.
- Styling: Tailwind CSS v4 utilities in TSX. `src/app/globals.css` provides the Tailwind import, semantic light/dark tokens, saved palette mappings, typography helpers, and glass material. No old static HTML or CSS assets are served.
- Type: locally bundled Geist, tabular financial values, 14px body/table text, 16px mobile inputs, 20px panel titles, and 30px page headings.
- Layout: desktop sidebar, modal mobile navigation, responsive panels, horizontally scrollable data tables, and a product/cart POS layout.
- Interaction: React state, shadcn/Radix accessible dialogs and selects, explicit form loading/errors, duplicate-submit guards, keyboard search, sorting, pagination, and non-mutating row selection.
- Themes: light/dark and nine palettes retain `techkasir.appearance`; sidebar and catalogue preferences retain their existing storage keys.
- Money: display and derived balances use integer/BigInt arithmetic. Form submission rejects unsafe integers and the existing backend remains authoritative.
- Data: existing API, cookies, permissions, SQLite records, and printable invoices are retained. `server.mjs` serves both Next.js and the API on one origin.

The former frontend and its design notes are archived in `qa/legacy-frontend` as historical regression fixtures. They are not part of the active browser application.

Use `npm.cmd run dev`, `npm.cmd run build`, `npm.cmd run typecheck`, and `npm.cmd run test:next`. See `NEXT-FRONTEND-PLAN.md` for migration scope and verification results.
