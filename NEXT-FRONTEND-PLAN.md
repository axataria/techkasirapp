# Next.js frontend migration

Status: implemented. Next.js production build, TypeScript checks, existing regression suites, and new Next.js integration checks pass.

## Intent

Rebuild the complete frontend with Next.js App Router, React, TypeScript, Tailwind CSS v4, and actual shadcn/ui components. Retain TechKasir's glassmorphism identity and Indonesian operational copy. Use the existing Node.js API and SQLite database. The final frontend must not retain the old DOM-driven renderer or imitation shadcn components.

## Pre-migration app audit

- Frontend: public/app.js, public/v2.js, public/theme.js, public/search.js, and public/data-table.js.
- Styling files to replace: public/style.css, public/v2.css, and src/ui.css, compiled to public/ui.css.
- Backend: server.mjs and v2.mjs, built with node:http and node:sqlite. Node.js 24 or newer is required.
- Main navigation: Dasbor, Kasir, Riwayat pesanan, Pelanggan, Garansi, Retur pelanggan, Produk, Barang masuk, QC, Retur supplier, Report, and Pengaturan.
- Supporting workflows: setup, login, service jobs, payment history, expenses/income/losses, staff management, audit, appearance settings, and global search.
- Documents: authenticated /document?type=...&id=... links and browser printing.
- Existing working tree contains uncommitted changes. Preserve those changes and the store database.

## Design decisions

Mode: redesign overhaul. Operational screens for owners, cashiers, and service staff, viewed at laptop and phone distances. Quiet, legible, compact, with glass limited to structural surfaces.

Design read: a frosted glass store workspace with stable navigation and dense, readable business data. Visual variance 4/10, motion 2/10, information density 8/10, asset dependence 1/10, brand fidelity 7/10. These choices retain the navigation grid, avoid decorative imagery, and reserve motion for direct feedback.

- Narrative role: operational data and transaction entry, with an immediately visible primary action per screen.
- Viewing distance: close range laptop and phone use; numeric data must be easy to compare.
- Visual temperature: calm, precise, approachable.
- Capacity: preserve the POS product area and right cart panel, desktop tables, and usable mobile layouts.
- Anchor: custom TechKasir glassmorphism; keep the existing wordmark.
- Palette: emerald primary #059669, light canvas #f5f7f6, dark canvas #181818, dark surfaces #1f1f1f and #272727. Use semantic success, warning, and destructive roles. Retain saved appearance palette choices through theme token mappings.
- Materials: translucent full-border sidebar/header/cards, subtle highlights, restrained shadows, and 16px backdrop blur on structural surfaces. Forms, menus, and modal content use sufficiently opaque surfaces for legibility. Provide an opaque fallback when backdrop filtering is unsupported.
- Typography: Geist, with 14px/20px labels and table text, 16px/24px form inputs, 20px/28px section titles, and 30px/36px page headings. Numeric values use tabular figures.
- Spacing: 4, 8, 12, 16, 24, 32, and 48px. Compact operational layouts with 44px touch targets.
- Corners: 16px panels, 12px dialogs, 8px controls. Full borders throughout.
- Shadows: faint elevation for panels; stronger elevation only for menus and dialogs.
- Motion: minimal opacity/transform feedback, 200ms with cubic-bezier(0.22,1,0.36,1); respect reduced motion. No animated blur or decorative page entrances.
- Accessibility: keyboard navigation, visible focus, dialog focus management, semantic labels, status announcements, and contrast independent of transparency.

## Implementation architecture

The authenticated workspace is now mounted once from the root layout. Route pages validate the URL without recreating the shell. Header and sidebar stay outside the independently scrolling content region; only content loading states and screens change during navigation. Pointer navigation fades in ready content over 180ms using opacity; keyboard navigation and reduced-motion preferences use immediate updates. Request generations prevent obsolete section responses from replacing current data.

1. Next.js App Router lives in src/app. TypeScript, Tailwind PostCSS, shadcn aliases, and registry settings are configured at the project root. The former public frontend lives only in qa/legacy-frontend as regression fixtures.
2. server.mjs is the primary browser entry point. It invokes existing store request handlers directly for /api/* and /document, keeping Next.js and the API on one origin. Tests verify cookies, authenticated writes, and cross-origin rejection. No separate API proxy or backend port is required.
3. Build reusable shadcn/ui Button, Input, Label, Card, Dialog, Sheet, Select, DropdownMenu, Tabs, Table, Badge, Skeleton, and related primitives. Business screens must use React components rather than embedding the old app in an iframe or injecting its HTML.
4. Implement setup/login, role-aware application shell, theme persistence, and search. Preserve existing persistent-state keys where possible.
5. Port every main and supporting screen, including detail views and forms, against the current API contracts. Preserve rupiah integer handling, Jakarta dates, validation, payment reversals, and document actions.
6. Switch development/production commands only after the new entry point works. Keep explicit legacy/backend commands for recovery and existing API checks.
7. Update README and UI documentation to describe the actual installed environment and commands.

## Protected contracts

Preserve API paths/payloads, database schema/data, account credentials and sessions, role restrictions, business calculations, print links, existing labels, and complete workflows. Introduce Next.js routing deliberately and retain compatibility with existing record links. Avoid replacing real records with demo metrics.

Highest risk: transaction forms, session forwarding, and POS payment behavior during the frontend rewrite. Existing backend tests remain the regression baseline.

## Verification

- Resolve dependencies and verify TypeScript and production Next.js build.
- Run the existing integration suite using its isolated temporary database.
- Verify setup/login/logout, role navigation, search, themes, and representative read/write workflows against isolated data.
- Verify POS totals, deposits/installments, error handling, duplicate submission prevention, documents, receiving/QC, warranty/returns, and reports.
- Inspect responsive rules and keyboard/focus behavior. Disclose any workflow or visual verification that could not be completed.

## First reviewable draft

Show the Next.js login and authenticated shell with glass tokens, real shadcn controls, responsive navigation, and light/dark modes before extending the design across all business screens. A design review checkpoint is required by the web-design-engineer skill before implementation and again after the first draft.

## Official references

- https://nextjs.org/docs/app/getting-started/installation
- https://ui.shadcn.com/docs/installation/manual

## Verification results

- Next.js 16.4.5 production build: passed. React 19.3.1, Tailwind 4.3.5, TypeScript 7.0.2.
- TypeScript: passed.
- Existing eight regression suites: passed. Legacy UI source assertions now read archived fixtures; API, domain, and migration tests remain active backend regressions.
- next.test.mjs: passed for 16 application routes, static build assets, old asset URLs returning 404, setup/login/logout cookies, authenticated writes, same-origin validation, and summary access. Uses a separate temporary store.
- Browser review on an isolated seeded preview: login passed; selecting a unit, cash sale submission, stock removal, order selection, invoice/receipt links, and database search results passed. No real store transactions were created during the browser checks.
- Limits: every individual dialog and every small viewport have not been exercised in a browser. Responsive Tailwind layouts are implemented; further visual coverage can be expanded.
