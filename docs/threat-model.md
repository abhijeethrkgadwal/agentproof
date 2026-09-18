# Threat Model (Phase 6)

AgentProof assesses **interaction risk** for a session. It does **not** claim to prove a user is human or that the system is “AI-proof.”

## In scope

- Forged / tampered challenge tokens (HMAC)
- Replay of consumed challenges
- Expired challenges
- Client-claimed success without server ground truth
- Issued-payload offline derivation (Phase 2 class — blocked since Phase 3)
- Premature verification before active window
- Progressive frame trail reconstruction (measured; Phase 5 display harden + Lab V2)
- Direct HTTP solving without UI
- State inference from client-visible JSON

## Out of scope (current)

- Distributed botnets / residential proxies at scale
- Paid human farms
- Full multimodal vision agents (L3 stub only)
- External ML / Jev integration (deferred)
- Complete WCAG conformance audit

## Deployment architecture (Phase 7)

```text
Next.js (one or more nodes)
  ├─ memory stores          (local / CI)
  └─ Redis (optional)       challenge + session + rate-limit
       AGENTPROOF_STORAGE_BACKEND=redis
       AGENTPROOF_REDIS_URL=redis://…
```

Signed sessions + shared Redis are required for correct replay protection across processes.


| Property | Status |
|----------|--------|
| Offline segment derive | Blocked |
| Static GT in issued payload | Blocked |
| Replay | Blocked |
| Tamper | Blocked |
| Premature verify | Blocked |
| Expired challenge | Blocked |
| Frame-trail automation | Measurable residual; Lab V2 tracks |

## Privacy principles

Minimal telemetry. No fingerprinting, keystroke logs, clipboard, precise location, or biometrics.

## Residual weaknesses

Adaptive filtering may still recover direction changes; vision agents untested; human-farm economics unmodeled; accessibility path is pilot-grade.

See also historical `docs/THREAT-MODEL.md` (Phase 1) and phase attack reports under the project store `internal/`.
