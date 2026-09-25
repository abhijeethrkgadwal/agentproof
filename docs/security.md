# Security

**Label:** Research Prototype - not production security infrastructure.

AgentProof is an adaptive verification research prototype. It measures interaction risk and raises the cost of automation. It does **not** claim to be AI-proof, CAPTCHA-complete, or suitable as sole production authentication.

## Trust boundaries

| Boundary | Server authority |
|----------|------------------|
| Ground truth | Never sent to the client |
| Pass / fail | Decided only in `POST /api/verify` |
| Challenge motion plan | Held server-side; `/frame` returns display poses ≠ GT math |
| Session | Signed `agentproof_sid` cookie + SessionStore |
| Challenge token | HMAC over challenge metadata |

## Controls shipped

- HMAC-signed challenge tokens and short-lived signed sessions
- One-time consume / replay rejection
- Active-window gating (premature verify blocked)
- Rate limiting (memory or Redis-distributed)
- Optional API keys (hashed at rest); **live** environment requires a live key
- Invalid / revoked keys rejected (not silently ignored)
- Test vs live environment separation on keys and sessions
- Explainable `RuleDecisionEngine` (no ML)

## Threat model (summary)

See [`threat-model.md`](./threat-model.md). High-level: network observers, scripted solvers, replay/tamper, polling reconstruction, and API abuse.

## What this is not

- Not a WAF, bot-management CDN, or identity provider
- Not a guarantee against motivated attackers with vision models or human farms
- Not production-hardened multi-tenant SaaS security

## Reporting

Treat findings as research notes. Prefer opening issues on
[github.com/abhijeethrkgadwal/agentproof](https://github.com/abhijeethrkgadwal/agentproof).
Do not deploy as production security infrastructure without independent review.
