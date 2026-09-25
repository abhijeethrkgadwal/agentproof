# Accessibility notes

**Label:** Research Prototype - not WCAG-certified.

## What visitors should know

AgentProof’s main natural demos are pointer/drag based. For people who prefer a **keyboard or list** experience, use:

**[/demo/accessible](/demo/accessible)** - “Watch, then choose”

That path is the **temporal research challenge** without a canvas:

1. Read the instruction  
2. Start watching  
3. Wait until watching finishes  
4. Select an object from the list  
5. Verify  

It uses the **same server protocol** as the visual temporal demo (`/challenge` → `/start` → `/frame` → `/verify`).

Natural demos also offer an in-challenge **“Use keyboard controls”** toggle for discrete nudges. That is a pilot aid, not a full accessibility program.

## Pilot status

| Path | Status |
|------|--------|
| `/demo/accessible` | Operable with keyboard focus + `aria-live` status |
| Natural “keyboard controls” | Pilot nudges; not a complete alternative UX |
| Full WCAG 2.2 AA | **Not claimed** |

## Remaining gaps

- Canvas paths are not fully keyboard-operable
- Color remains one object cue (also labeled with id / shape / position)
- No independent screen-reader certification (NVDA / VoiceOver)
- Contrast / `prefers-reduced-motion` not fully audited

**Do not claim full WCAG compliance without an independent audit.**
