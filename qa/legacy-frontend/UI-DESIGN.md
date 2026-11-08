# Shared component styling

Mode: preserve. Audience: cashiers and store owners using repeated operational workflows on laptops and phones.

The component layer uses Tailwind CSS and shadcn-style semantic roles, adapted to the app's native HTML and JavaScript. It is not an installation of the React shadcn component library. The existing header composition, navigation, forms, field names, routes, account identity, and financial logic remain intact.

## Design read

Quiet operational UI, with one prominent action per task. Visual variance 2/10; motion 1/10; information density 7/10; asset dependence 1/10; brand fidelity 9/10. This is a close-range work tool: compact controls must stay readable, have generous touch targets, and show their state without decorative animation.

## System

- Existing Plus Jakarta Sans typography; 14px/20px controls and labels, 12px/20px helper text, 18px/28px modal titles. Mobile text inputs use 16px.
- Existing `--paper`, `--ink`, `--accent`, `--selection`, `--muted`, `--line`, and `--focus` values remain the source of theme colors.
- Flat, opaque input/dialog/menu surfaces. Subtle full borders; focus rings follow the saved theme.
- 44px standard controls, 36px compact buttons on fine pointers, 44px touch controls. 8px control corners, 12px dialog corners.
- Primary filled actions, outlined secondary actions, quiet borderless ghost actions. Sign-out is a quiet destructive menu item.
- Shared search-field treatment across global search, customers, catalogue, and data tables.
- Native select semantics and browser keyboard behavior are retained, with a coordinated closed-control appearance. Account and table-action popovers share the dialog surface treatment.
- Only short color/border feedback. No new entrance, keyboard, or layout animation. Reduced motion removes transitions.

## Source and build

Edit `src/ui.css`, then run `npm run build:css`. The generated `public/ui.css` is included for runtime use without an installation step. Tailwind Preflight is deliberately omitted to protect existing page layouts.

References: [Tailwind CLI](https://tailwindcss.com/docs/installation/tailwind-cli), [shadcn theming](https://ui.shadcn.com/docs/theming), [shadcn button](https://ui.shadcn.com/docs/components/button).
