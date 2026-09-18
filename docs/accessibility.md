# Accessibility notes (Phase 7)

The `/demo/accessible` path provides an **equivalent progressive-frame verification** using a list of objects, live region updates, and keyboard-focusable controls.

## What works in the pilot

- Same server protocol as canvas (`/challenge` → `/start` → `/frame` → `/verify`)
- Difficulty 1 and 2
- `aria-live` status updates
- Button list selection with `aria-pressed`
- Focus outlines on controls

## Remaining WCAG gaps (not a full audit)

- No complete keyboard canvas alternative beyond the list path
- Color is still used as one object cue (also labeled with id/shape/position)
- No full screen-reader scripted evaluation yet
- Contrast / motion preferences not fully audited
- No formal WCAG 2.2 AA conformance claim

**Do not claim full WCAG compliance without an independent audit.**
