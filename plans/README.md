# TechKasir animation plans

Dashboard-first MVP requested on 2026-11-10. Plan 001 is implemented. Mechanical checks passed and browser acceptance is partially verified.

| Plan | Title | Severity | Status | Dependencies |
| --- | --- | --- | --- | --- |
| [001](001-dashboard-fluid-motion-mvp.md) | Make dashboard transitions fluid without slowing work | MEDIUM | Implemented, browser acceptance partial | None |

## Execution order

Execute plan 001 in its internal order: correct timing and cancellation, match loading structure, add the scoped payment-detail entrance and dashboard hover feedback, then verify production, keyboard, reduced-motion and touch behavior. Review the MVP before expanding motion to other screens.

## Intended experience

- A stable dashboard shell and a predictable pointer-navigation reveal.
- Static placeholders aligned with the dashboard structure.
- A subtle 200ms centered payment-detail entrance, immediately dismissible.
- Subtle 200ms hover highlights on clickable dashboard actions and activity rows, gated to mouse/trackpad input; financial cards remain stable.
- Immediate financial values, chart selection and keyboard operations.

## Scope decisions

The existing design explicitly favors low motion and documents the page fade. Preserve that tradeoff and fix its parsing rather than treating all existing motion as a regression. Optional later work includes mobile navigation and other occasional overlays; it is not authorized for implementation by this plan.

No commit stamp is available: the current directory has no Git metadata. Plan 001 includes source hashes and code excerpts for drift checks.
