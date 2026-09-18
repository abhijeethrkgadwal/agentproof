# Agent Lab

AgentProof’s **Agent Evaluation Lab** measures how expensive and reliable it is to automate the verification challenge.

## Levels

| Level | Description |
|-------|-------------|
| Human observations | Real `/study` pilot aggregates only |
| L1 API observer | Poll `/frame`, reconstruct trails, verify |
| L2 Playwright | Browser automation on `/demo` |
| L3 Vision | Stub interface only (no model) |
| Lab V2 A–F | Stronger automated strategies (see below) |

## Lab V2 attacks

| Code | Name | Goal |
|------|------|------|
| A | `frame_reconstruction_v2` | Adaptive smoothing + path reconstruction despite display harden |
| B | `polling_optimisation` | Cheapest successful poll interval |
| C | `timing_attack` | Early verify at fractions of active window |
| D | `direct_api_attack` | HTTP-only solve (no UI) |
| E | `state_inference` | Infer GT from issued client state only |
| F | `replay_tampering` | Replay + HMAC tamper bypass attempts |

## Automation Cost

Normalized **experimental** metric (not a universal security score):

```text
AutomationCost =
  timeToSolveMs/1000
  + 0.5 * interactionCount
  + 0.1 * framesObserved
  + 0.05 * apiRequestCount
```

Higher ⇒ more expensive to automate in this lab setup.

## Commands

```bash
npm run lab:l1 -- http://127.0.0.1:43123 5
npm run lab:l2
npm run lab:v2 -- http://127.0.0.1:43123 all
npm run lab:gates -- http://127.0.0.1:43123
```

Dashboard: `/lab`

## Attack run schema

Each Lab V2 run stores: `attackLevel`, `attackName`, `challengeDifficulty`, `success`, `solveTimeMs`, `frameCount`, `apiRequestCount`, `interactionCount`, `retryCount`, `failureReason`, `timestamp`, `automationCost`.

No secrets or unnecessary client data.

## Regression gates

`npm run lab:gates` **fails** if offline derivation, static payload extraction, replay, tamper, premature verify, or Lab V2 security-bypass attacks succeed for the attacker.

Frame-reconstruction / adaptive / direct-API outcomes are **reported as measurements** (may be non-zero).
