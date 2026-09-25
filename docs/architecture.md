# Architecture

**Label:** Research Prototype - not production security infrastructure.

## Overview

```text
Browser                     Server
──────                     ──────
POST /api/challenge  ────> signed session cookie + issued identity
POST /start,/frame   ────> progressive display poses (≠ GT math)
POST /api/verify     ────> GT check ⟂ DecisionEngine(features)
                     <──── verified + decision + risk factors
```

Challenge types: `temporal` | `drag_avoid` | `physical` | `dynamic_path`.

## Components

| Area | Path | Role |
|------|------|------|
| Challenge core | `lib/challenge/core/` | Shared registry, meta, trajectory, difficulty |
| Challenge modules | `lib/challenge/{generator,drag-avoid,physical,dynamic-path}/` | Per-type GT, frames, validation |
| Public projection | `lib/challenge/public.ts` | Strips motion plan / GT from client payloads |
| Display harden | `lib/challenge/displayPose.ts` | Lag, contamination, GT-biased warp on `/frame` |
| Signing | `lib/security/signing.ts` | HMAC challenge tokens |
| Session | `lib/security/session.ts` | Signed cookie + SessionStore |
| Rate limit | `lib/security/rateLimit.ts` | Fixed-window via RateLimitStore (incl. frame ceiling) |
| Risk profiles | `lib/risk/profiles.ts` | Challenge-aware thresholds (temporal vs natural) |
| Risk rules / score | `lib/risk/rules.ts`, `lib/risk/score.ts` | Factor weights → riskScore |
| Decision | `lib/decision/ruleEngine.ts` | Explainable allow / step_up / restrict |
| Storage | `lib/storage/*` | Memory (default) or Redis |
| Study | `lib/study/*` | Anonymous pilot attempts + aggregates |
| Lab | `lib/lab/*` | Automated attack runners A-F + natural placeholders |
| Developers | `lib/developers/*` | Projects + hashed API keys |
| SDK | `public/agentproof-sdk.js` | Minimal browser embed |

## Product surfaces

| Route | Purpose |
|-------|---------|
| `/demo` | Challenge hub (natural first; temporal research last) |
| `/demo/drag-avoid`, `/physical`, `/dynamic-path` | v0.2 natural challenges |
| `/demo/temporal` | Original research temporal challenge |
| `/demo/accessible` | Temporal list / keyboard path (pilot) |
| `/lab` | Agent Lab dashboard |
| `/study` | Observational human pilot |
| `/challenge-lab` | Internal UX comparison (dev; no stats claims) |

## Storage backends

| `AGENTPROOF_STORAGE_BACKEND` | Behavior |
|------------------------------|----------|
| `memory` (default) | In-process maps - fine for local demo / tests |
| `redis` | Challenge, session, and rate-limit state shared across Node processes |

Boot: `instrumentation.ts` calls `initStorageBackends()`. Requires `AGENTPROOF_REDIS_URL` (or `REDIS_URL`).

## Progressive frame protocol

1. **Issue** - client receives scene identity + instruction + token (no segments / GT).
2. **Start** - server starts the active window; first display poses returned.
3. **Frame** - polled poses use display transforms so reconstructed trails ≠ ground-truth paths.
4. **Verify** - server checks interaction against GT, lifecycle, session, signature, telemetry features, then DecisionEngine.

## Decisions (challenge-aware)

`RuleDecisionEngine` combines timing, frame cadence, retries, and interaction heuristics into `allow` · `step_up` · `restrict` with factor explanations.

Risk thresholds come from `lib/risk/profiles.ts`:

- **temporal** - stricter click-style heuristics (lower interaction ceilings)
- **natural** (`drag_avoid` / `physical` / `dynamic_path`) - expects dense pointer streams; does not over-punish legitimate high event counts when GT verifies

No ML / Jev by default.

## Multi-process

For more than one Node instance, use Redis. See `npm run soak:redis` and [`limitations.md`](./limitations.md).
