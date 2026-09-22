# AgentProof v0.2 — Natural interaction challenges

**v0.2 is an experimental challenge UX release and is not production security infrastructure.**

## Overview

AgentProof v0.1 delivered the research/security foundation (temporal challenge, HMAC, lifecycle, Lab gates).

AgentProof v0.2 adds three **natural-interaction** challenge experiments on the same server-authoritative protocol:

| Type | Route | Instruction |
|------|-------|-------------|
| `temporal` | `/demo/temporal` | Original research challenge — observe direction changes |
| `drag_avoid` | `/demo/drag-avoid` | Drag the blue object to the green target without hitting moving obstacles |
| `physical` | `/demo/physical` | Place the red block on the platform without knocking the blue block off |
| `dynamic_path` | `/demo/dynamic-path` | Guide the ball through the opening |

Shared architecture: `lib/challenge/core/` + per-type modules under `lib/challenge/{temporal retained, drag-avoid, physical, dynamic-path}/`.

## Drag & Avoid

- **User goal:** move the agent into the target without obstacle collisions (~4–7s).
- **Interaction:** pointer/touch drag; accessible corridor sequence fallback.
- **Security model:** obstacle motion plans stay server-side; frames reveal current poses only.
- **Server validation:** start proximity, trajectory continuity/speed, collisions vs authoritative obstacle positions, final target placement, lifecycle.
- **Client-visible:** agent/target identity, target position, obstacle count — not segments/starts.
- **Attack surface:** frame observation + trajectory forging; cannot solve from issued JSON alone.
- **Accessibility:** keyboard corridor labels (`north` / `center` / `south`). Pilot — not WCAG-certified.
- **Difficulty:** obstacle count, speed, segment complexity (UI exposes 1–2).
- **Lab strategy:** placeholder attacker only until a real interaction harness exists.

## Physical Interaction

- **User goal:** park the red block on the platform without displacing the blue block.
- **Interaction:** drag with lightweight deterministic push physics.
- **Security model:** protected bounds + accessible placement key are server-only.
- **Server validation:** re-simulates agent path; checks agent on platform and protected body within bounds.
- **Client-visible:** body starts, platform rect — not protectedBounds / placement key.
- **Attack surface:** forged final positions; server ignores client “success” flags.
- **Accessibility:** left/center/right placement choice.
- **Difficulty:** extra static props + tighter timing window.
- **Lab strategy:** placeholder only.

## Dynamic Path

- **User goal:** guide the ball through moving gate openings to the goal line.
- **Interaction:** continuous drag; accessible discrete slot picks.
- **Security model:** gate opening schedules (`segments`, `openingCenterStart`) server-only.
- **Server validation:** gate crossings through openings at sample times; reach goalX; speed limits.
- **Client-visible:** gate x + opening height; current opening center via frames.
- **Attack surface:** predicting future openings from sparse frames — still requires interaction.
- **Accessibility:** slot indices 0–2 per gate.
- **Difficulty:** gate count, opening size, vertical speed.
- **Lab strategy:** placeholder only.

## Protocol (unchanged)

```text
ISSUE → START → ACTIVE → INTERACTION → VERIFY → CONSUME → DECISION
```

HMAC · nonce · expiry · replay · session binding · Redis-ready stores · FeatureSnapshot · RuleDecisionEngine.

## Human-first lab

`/challenge-lab` records clarity, time, success, retries, abandonment, subjective difficulty for development testing only — **no statistical validity claimed**.

## Product framing

We are measuring **human usability vs automation effort**, not proving challenges are impossible for AI.
