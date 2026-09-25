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

## Components

| Area | Path | Role |
|------|------|------|
| Challenge generator | `lib/challenge/` | Temporal object scenes, GT, display pose transform |
| Public projection | `lib/challenge/public.ts` | Strips motion plan / GT from client payloads |
| Signing | `lib/security/signing.ts` | HMAC challenge tokens |
| Session | `lib/security/session.ts` | Signed cookie + SessionStore |
| Rate limit | `lib/security/rateLimit.ts` | Fixed-window via RateLimitStore |
| Decision | `lib/decision/ruleEngine.ts` | Explainable allow / step_up / restrict |
| Storage | `lib/storage/*` | Memory (default) or Redis |
| Study | `lib/study/*` | Anonymous pilot attempts + aggregates |
| Lab | `lib/lab/*` | Automated attack runners A-F |
| Developers | `lib/developers/*` | Projects + hashed API keys |
| SDK | `public/agentproof-sdk.js` | Minimal browser embed |

## Storage backends

| `AGENTPROOF_STORAGE_BACKEND` | Behavior |
|------------------------------|----------|
| `memory` (default) | In-process maps - fine for local demo / tests |
| `redis` | Challenge, session, and rate-limit state shared across Node processes |

Boot: `instrumentation.ts` calls `initStorageBackends()`. Requires `AGENTPROOF_REDIS_URL` (or `REDIS_URL`).

## Progressive frame protocol

1. **Issue** - client receives scene identity + instruction + token (no segments).
2. **Start** - server starts the active window; first display poses returned.
3. **Frame** - polled poses use display transforms (lag, contamination, GT-biased warp) so reconstructed trails ≠ ground-truth paths.
4. **Verify** - server checks selection against GT, lifecycle, session, signature, telemetry features, then DecisionEngine.

## Decisions

`RuleDecisionEngine` combines timing, frame cadence, retries, and interaction heuristics into `allow` · `step_up` · `restrict` with factor explanations. No ML / Jev.

## Multi-process

For more than one Node instance, use Redis. See `npm run soak:redis` and [`limitations.md`](./limitations.md).
