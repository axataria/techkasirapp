# 001 — Make dashboard transitions fluid without slowing work

- **Status**: Implemented — mechanical checks pass; browser acceptance partially verified.
- **Date**: 2026-11-10 (Asia/Jakarta).
- **Commit**: unavailable. `git rev-parse --short HEAD` reports that this workspace is not a Git repository. Do not invent a commit or initialize Git.
- **Severity**: MEDIUM.
- **Category**: Easing & duration; interruptibility; accessibility; missed opportunities.
- **Estimated scope**: 5 existing source files, one small dashboard loading component, one focused timing test; roughly 180–290 lines.
- **Invocation**: user explicitly requested a plan for a dashboard-first fluid-animation MVP. This is the skill's `plan <description>` workflow, not an app-wide audit awaiting issue selection.

## Problem

Repository root: `D:/Web App Dev/techkasirapp-main`.

The owner dashboard is `/dashboard` (also the authenticated `/` default). `src/components/screens.tsx:49` defines `Dashboard`; `workspace.tsx` owns its loading, navigation and dialogs. This is a Next.js/React/Tailwind 4/Radix app using CSS and WAAPI, with no animation library.

The user wants the dashboard to feel fluid. Financial values, chart selection and operational actions must remain immediately readable and usable. There is no justification for number count-ups, growing chart bars, card hover lifts or cascading rows.

Three related seams form this MVP:

1. `src/components/workspace.tsx:66–74` parses a CSS time without respecting its unit:

```tsx
const style = getComputedStyle(contentArea.current);
const animation = contentArea.current.animate([{ opacity: 0 }, { opacity: 1 }], {
  duration: parseFloat(style.getPropertyValue("--section-fade-duration")) || 180,
  easing: style.getPropertyValue("--ease-ui").trim() || "cubic-bezier(.22,1,.36,1)",
});
return () => animation.cancel();
```

`src/app/globals.css:5–6` currently declares:

```css
--ease-ui: cubic-bezier(.22,1,.36,1);
--section-fade-duration: 180ms;
```

The prior browser review found the production computed token `.18s`. `parseFloat` therefore supplies 0.18ms to WAAPI. This is a timing defect, not proof that the current interface waits 180ms.

2. `src/components/workspace.tsx:217` uses one generic loading layout: an `h-12` heading, three `h-32` cards and an `h-80` panel. The dashboard at `screens.tsx:54–57` instead contains four metrics, a chart plus operational panel, and two activity panels. The mismatch can make the handoff jump. This is a source-based risk; measure it during execution.

3. Clicking a recent payment in `src/components/screens.tsx:57` invokes this exact callback:

```tsx
onClick={() => c.act("payment-detail", p)}
```

`src/components/workspace.tsx:209` opens content through:

```tsx
detail: (title, content) => setDialog({ title, content })
```

`src/components/ui/dialog.tsx:64` declares zoom/fade utility classes, but the current stylesheet imports only Tailwind; the production CSS has no corresponding entrance keyframes. Browser inspection confirmed `animation: none` on dialogs. An occasional dashboard detail overlay is an appropriate place for a subtle, purposeful transition.

## Target

### A. Predictable dashboard data handoff

- Preserve the documented pointer-only page fade: **180ms opacity 0 → 1**, existing **`cubic-bezier(.22,1,.36,1)`**. This is an explicit existing product tradeoff in `NEXT-FRONTEND-PLAN.md:36–41`, not a new decorative entrance. Do not add transforms or stagger to financial panels.
- Parse CSS time correctly: `180ms` and `.18s` both yield 180 milliseconds. A numeric zero is valid; blank/invalid values use the existing 180ms fallback.
- Keyboard navigation and reduced-motion navigation stay immediate. Do not replay the entrance for a dashboard refresh, chart-month selection, theme change or updated figures.
- Cancel pending page animation on any new keyboard/pointer interaction and on route replacement. Cancellation reveals the final underlying content; it never leaves opacity at zero.
- Use a dashboard-specific skeleton matching the four-metric and two-column structural grids. Do not hold finished data for a minimum loading duration. Skeletons are static; status text and `aria-busy` communicate loading.

### B. Dashboard payment details

- Scope the new motion to the generic detail dialog opened from `/dashboard`, not forms, search, other routes or all Radix dialogs.
- Pointer/touch opening: content **opacity 0 → 1**, **`scale(0.97) → scale(1)`**, centered origin, **200ms `cubic-bezier(0.23,1,0.32,1)`**.
- Backdrop: opacity only over **200ms**, same curve. Never animate backdrop blur.
- Closing: immediate for this MVP so Escape, focus restoration and the next action never wait for an exit animation. An animated exit can be considered later with proper presence/focus semantics.
- Keyboard opening: immediate, with no transform or opacity transition.
- Reduced motion: pointer-open content/backdrop use opacity only over **200ms**; no scaling. Keyboard remains immediate.
- Reopening while still open or changing its content does not replay entry. Close during entry cancels immediately. No artificial timers, no retained invisible focus traps.
- Dialog content is mounted and focused immediately by Radix; animation never determines when focus or pointer interaction becomes available.

New values (200ms, scale 0.97 and strong ease-out curve) are from `C:/Users/acer/.agents/skills/improve-animations/AUDIT.md`, sections 2, 3 and 6. The existing page fade's 180ms/.22 curve is preserved as the documented product exception under the skill's Hard Rule 5.

### C. Dashboard hover feedback — added at the user's request

- Add a subtle background highlight that fades in/out on the dashboard's operational action buttons, chart `Detail` button, active-service rows and recent-payment rows (`screens.tsx:55–57`). These are clickable targets; metric cards and panel containers are not.
- Use an absolutely positioned, rounded, pointer-events-none `::before` layer with the existing `var(--accent)` background. Transition **opacity 0 → 1 over 200ms `cubic-bezier(.22,1,.36,1)`**, using `var(--ease-ui)`. Keep the host's background/border static; do not animate paint properties such as box-shadow or background-color. The 200ms budget is within AUDIT.md's small-UI range; the curve preserves the documented repository convention.
- Make each opt-in target `position: relative; isolation: isolate`; place the layer at `inset: 0; border-radius: inherit; z-index: -1`. Do not add overflow clipping that could cut off focus rings. Validate layering in light/dark themes.
- For the primary `Catat penjualan` button, keep its current primary surface and animate only the existing Plus icon's opacity from **0.7 → 1**, using the same 200ms transition. Keep the accessible label and button hitbox unchanged.
- Gate BOTH transition declarations and hover rules inside **`@media (hover: hover) and (pointer: fine)`**. Touch receives the existing immediate press behavior; it must not latch into an animated hover state.
- Under reduced motion, disable the hover transition and show the same highlight immediately. This retains a clear affordance without a repeated animation. Keyboard focus/activation remains immediate; `:focus-visible` must disable these transitions and reveal the appropriate highlight immediately even if the pointer is resting on the control.
- Enter/leave must reverse from current opacity with CSS transitions. No keyframes, event timers, delayed click handlers, scale changes, row movement or looping effects.
- Keep chart bars and financial metric cards unchanged. Do not suggest clickability on passive panels. Hover does not change selection, totals or status text.

## Repo conventions to follow

- Keep CSS tokens in `src/app/globals.css`; use existing `--ease-ui` rather than introducing a second global easing system. Scope its `cubic-bezier(0.23,1,0.32,1)` override to the opt-in dashboard dialog surface only. Keep the original token everywhere else.
- Keep the shared workspace mounted, as in `workspace.tsx:212–220`; never key the entire shell to the route.
- Preserve Radix portal, focus, scroll-lock and close semantics in `ui/dialog.tsx:33–87`.
- Preserve existing dashboard Tailwind grid breakpoints, typography, gaps, heights and financial formatting from `screens.tsx:54–57`.
- New motion uses CSS transitions with `@starting-style` for the occasional mount, not keyframes or an added animation dependency. Unsupported `@starting-style` falls back to instant appearance.
- The `.01ms !important` reduced-motion blanket in `globals.css:81` remains unchanged outside this MVP. Opt-in dashboard dialog opacity rules must explicitly override its transition duration later in the stylesheet. Dashboard skeletons must use `animation: none`, not accelerated pulses.

## Steps

1. **Fix the existing CSS-time conversion in `workspace.tsx`.** Introduce a small pure helper (local export or adjacent helper module) that trims the string, recognizes `ms` and `s`, multiplies seconds by 1000, rejects negative/nonfinite/unsupported values and preserves zero. Replace only the duration expression. This shared bug fix is the sole intentional timing change outside the dashboard.
2. **Make page cancellation explicit in `workspace.tsx`.** Store the current WAAPI animation in a ref. Cancel and clear it before starting a replacement, on pointerdown/keydown and in effect cleanup. Keep the existing loading, reduced-motion and keyboard guards. Do not set persistent inline opacity or use `fill: forwards`; underlying CSS must remain fully visible after cancellation.
3. **Add `src/components/dashboard-loading.tsx`.** Match the dashboard's heading/date, four-metric grid and chart/operational grid using the existing classes from `screens.tsx`. Include the lower pair of panels with stable placeholders, but do not invent a fixed final height for variable activity lists. Use `Skeleton` with a scoped static class. Do not import `Screens` into this component. In `workspace.tsx:217`, select this component only when `page === "dashboard"` and data is pending; leave the existing fallback for other pages. Preserve accessible loading labels.
4. **Capture dialog activation intent in `workspace.tsx`.** Add an optional motion flag to the local dialog state, not the public `WorkspaceContext` API. When `detail` opens a dashboard detail, capture whether the last input was pointer/touch using the existing pointerNavigation ref. `form` always leaves the flag off. Keep this captured flag stable while the dialog is open; key presses inside it must not restart animation. Closing, route navigation and session changes clear the flag with the dialog state.
5. **Add an opt-in prop to `DialogContent` in `ui/dialog.tsx`.** Use `motion="dashboard-detail"` only for the generic workspace detail when the captured flag is set. Default is no new motion. Forward a matching data attribute to BOTH `DialogPrimitive.Content` and its `DialogOverlay`; do not spread the custom prop into the DOM. Use separate selectors so the backdrop never receives scale. Keep Tailwind's existing `translate` centering intact when applying `transform: scale(...)`.
6. **Add scoped CSS in `globals.css`.** Default visible state is opacity 1 and scale 1. Under `@starting-style`, only opted-in open content starts at opacity 0/scale .97, and its backdrop at opacity 0. Transition only opacity and transform for 200ms with the scoped strong ease-out token. Under reduced motion, both starting and final transforms are `none`; retain opacity transition for 200ms with an explicit override of the blanket duration. No closed-state animation: Radix unmounts immediately. All default, focus and error states work without transition support.
7. **Opt in dashboard hover targets in `screens.tsx:54–57`.** Add `dashboard-hover-surface` only to the chart Detail button, operational action buttons and the two kinds of clickable activity rows. Add `dashboard-hover-primary` only to Catat penjualan. For these instances, remove/override existing immediate hover background classes to avoid a background snap beneath the fading layer. Do not change `ui/button.tsx` globally. Preserve roles, handlers, focus rings and disabled handling. Add the scoped CSS described in target C to `globals.css`; exclude `:disabled` and `[aria-disabled="true"]` from hover styling. Override background hover utilities only on these marked instances, leaving their foreground behavior legible.
8. **Verify the rendered behavior before marking complete.** If the entry restarts on unrelated renders, focus waits, or immediate close fails, fix the opt-in lifecycle rather than adding timeouts. Leave animation-free behavior in place until the scoped implementation passes.

## Boundaries

- No new dependencies, no Motion/GSAP install, no global animation-utility enablement.
- No changes to sales/cart/checkout, search shortcut, table navigation, chart data, counters, API or database logic.
- No card stagger, animated numbers, growing bars, scroll reveals, bouncing surfaces, hover transforms or animated blur.
- No changes to sidebar motion in this dashboard MVP. Treat it as a separate future task.
- No broad cleanup of shared buttons, inputs, selects or dropdowns.
- Source changes are authorized only when the user asks to execute this plan. This planning step changes files under `plans/` only.
- If cited code has drifted, stop and report the mismatched section before implementing a substitute.

## Verification

### Mechanical (execution stage only)

1. Add a focused time-parser test using the repository's Node assertion style: `180ms → 180`, `.18s → 180`, `0ms → 0`, whitespace accepted, blank/invalid/negative → 180 fallback. Run that test with `node --test <actual-test-path>`; document its real path in the implementation report.
2. Run `npm run typecheck` and `npm run build`; require success. Building is necessary here because production CSS time serialization exposed the original defect.
3. Run `npm run test:next` after the build. This existing test uses an isolated temporary store.
4. Start `npm run preview` for browser checks, using its isolated demo store. Never seed or submit test transactions into the user's real database.

### Feel check

- Desktop and 390px: navigate to `/dashboard` by pointer and keyboard; verify the shell remains stationary. Inspect WAAPI timing: production duration is 180ms, not 0.18ms.
- With network throttling, verify the static skeleton preserves the dashboard structure and finished data appears immediately. No fabricated minimum waiting period.
- While the fade runs, click or type: content snaps to final visibility and accepts the action. Navigate away immediately; no obsolete animation survives.
- Refresh data and select chart months rapidly: totals and status text update instantly, with no entrance replay.
- Click a recent payment: centered, subtle scale + opacity entry; focus enters immediately. Close immediately with Escape; no invisible overlay blocks the next click. Repeat ten open/close cycles.
- Open the same detail with Enter: no animation. Verify visible keyboard focus and restoration to the invoking control; do not blame motion for a pre-existing focus bug without isolating it.
- Use DevTools Animations at 10% playback: inspect centering, backdrop opacity, lack of animated blur and absence of unintended content scaling beyond .97 → 1.
- Emulate `prefers-reduced-motion: reduce`: no position or scale changes; static loading; pointer detail uses only 200ms opacity; keyboard and navigation remain immediate. If tooling cannot emulate it, explicitly mark this acceptance item unverified rather than claiming completion.
- Test the dialog on an actual touch device before claiming touch validation. Resized desktop screenshots are not touch testing.
- Sweep the pointer rapidly across action buttons and activity rows, enter/leave the same target repeatedly, and click halfway through the fade. Highlights must reverse smoothly, clicks must fire immediately, and no target or financial text may move. Confirm the primary Plus icon remains visible at rest.
- Check hover in light/dark themes, disabled states, coarse-pointer emulation and reduced motion. Touch must not retain a hover highlight. Tab while the pointer rests on a target: focus must be immediate, with no animated focus cue. Ensure passive metric cards have no new hover behavior.
- Check `/sales`, Ctrl+K, selects and a non-dashboard dialog: no newly introduced animation.
- Inspect a browser performance trace for repeated layout during the new transition. Report measurements if making performance claims; never infer dropped frames from CSS alone.

**Done when:** timing is correct in the production build; dashboard loading does not add unnecessary layout displacement; the scoped detail entry is subtle and immediately interruptible; keyboard/reduced-motion cases pass; other operational routes retain their current behavior.

## Source baseline

SHA256 captured on 2026-11-10 because Git metadata is unavailable:

```text
src/components/workspace.tsx EC40136954D0752AAF480E9B1F05A6D4C16E1133D2622072AF57991BDA7F6F68
src/components/screens.tsx 1ABB2CF33F4799AD987AE255DDE55FF2218F57F9D1D843F3DA9C6D1336A9B1D3
src/app/globals.css 747D049D210D9C6BCB9E4E949B0046EAEA89283FBF53CC8E1EE9190CB82805C3
src/components/ui/dialog.tsx A387B6C660F76C5759E92E57C3A88B49D52FC2718CBE113636AF99F4BF5A14C3
```

## Implementation and verification

The workspace, dashboard and dialog source hashes matched the plan. The stylesheet had changed for the glass and contrast update. Its timing tokens and reduced-motion rule still matched. The dashboard outline hover override accounts for the newer shared rule while retaining its existing control surface.

- Passed `node --test css-time.test.mjs`, `npm run typecheck`, `npm run build`, and `npm run test:next`. The production build and integration tests ran in an isolated copy with local dependencies.
- Using `npm run preview` with an isolated demo store, confirmed production serializes the fade token as `.18s`, which the parser test converts to 180ms. Observed the pointer fade and fully visible keyboard navigation at desktop and 390px, with the header remaining opaque.
- Confirmed chart selection updates immediately and the pointer dialog computes 200ms for opacity and transform, with an opacity-only backdrop and centered translation. Enter opens without the opt-in transition. Escape removed both dialog and overlay in ten pointer-open cycles and restored row focus. The dialog fit at 390px.
- Checked the 200ms row transition and dark accent in computed styles. Confirmed the cashier page has no dashboard hover targets, and Ctrl+K, order selects and the order payment detail have no new entrance.
- Pending acceptance: throttled loading and measured skeleton handoff, exact WAAPI duration and cancellation-frame capture in the browser, rapid hover reversal and disabled/coarse-pointer/reduced-motion emulation, slow-motion playback and a performance trace, and a physical touch-device check. The 390px browser check verifies layout only. No production store was used.

### Motion review

| Before | After | Why |
| --- | --- | --- |
| Shared outline hover could replace the background immediately | Dashboard outline buttons keep the control surface under the fading accent layer | Removes the snap without changing shared button styling |
| A reduced-motion rule with lower specificity could leave the hover transition active | The scoped reduced-motion rule forces its duration to zero | Keyboard and reduced-motion feedback should appear immediately |
| The controlled dialog has no Radix trigger to restore focus to | Capture the dashboard payment row and restore focus on close | Keeps keyboard users at their place after Escape |

**Verdict:** Approve the scoped code after these fixes. Browser acceptance remains partial until the pending checks above can be run.
