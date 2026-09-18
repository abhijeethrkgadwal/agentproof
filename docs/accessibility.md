# Accessibility notes (Phase 8 validation)

**Label:** Research/portfolio prototype — not production security infrastructure.

The `/demo/accessible` path provides an **equivalent progressive-frame verification** using a list of objects, live region updates, and keyboard-focusable controls. The `/study` flow also offers a list presentation toggle.

## Validated in Phase 8 (manual checklist)

| Path | Result |
|------|--------|
| Keyboard-only on `/demo/accessible` | Start → select object (Tab/Enter) → Verify operable |
| Focus management | Controls are focusable; verify disabled until selection + complete |
| Screen-reader path | `aria-live` announces issue/start/complete; list buttons labeled with id/shape/color/position |
| Clear instructions | Challenge `instruction` text + live region copy |
| Study a11y toggle | List presentation records `accessibilityPathUsed` |

Evidence: `media/phase-8-a11y-validation.json` (checklist run).

## What works in the pilot

- Same server protocol as canvas (`/challenge` → `/start` → `/frame` → `/verify`)
- Difficulty 1 and 2
- `aria-live` status updates
- Button list selection with `aria-pressed` (accessible demo)
- Focus outlines on controls

## Remaining WCAG gaps (not a full audit)

- No complete keyboard canvas alternative beyond the list path
- Color is still used as one object cue (also labeled with id/shape/position)
- No independent screen-reader lab (NVDA/VoiceOver) certification
- Contrast / `prefers-reduced-motion` not fully audited
- No formal WCAG 2.2 AA conformance claim

**Do not claim full WCAG compliance without an independent audit.**
