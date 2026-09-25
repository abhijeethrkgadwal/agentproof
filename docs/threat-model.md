# Threat Model

AgentProof assesses **interaction risk** for a session. It does **not** claim to prove a user is human or that the system is “AI-proof.”

## In scope

- Forged / tampered challenge tokens (HMAC)
- Replay of consumed challenges
- Expired challenges
- Client-claimed success without server ground truth
- Issued-payload offline derivation (Phase 2 class - blocked since Phase 3)
- Premature verification before active window
- Progressive frame trail reconstruction (measured; display harden + Lab V2)
- Direct HTTP solving without UI
- State inference from client-visible JSON
- Forged trajectories / final poses on natural challenges (server re-validates)

## Out of scope (current)

- Distributed botnets / residential proxies at scale
- Paid human farms
- Full multimodal vision agents (L3 stub only)
- External ML / Jev integration (deferred)
- Complete WCAG conformance audit
- Real automated attackers for natural challenges (placeholders only in Lab)

## Deployment architecture

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
| Natural challenge forging | Server GT + trajectory / physics checks; Lab attackers not yet real |

## Privacy principles

Minimal telemetry. No fingerprinting, keystroke logs, clipboard, precise location, or biometrics.

## Residual weaknesses

Adaptive filtering may still recover direction changes; vision agents untested; human-farm economics unmodeled; accessibility path is pilot-grade; natural Lab attackers are placeholders only.

See also [`security.md`](./security.md), [`limitations.md`](./limitations.md), and [`agent-lab.md`](./agent-lab.md).
