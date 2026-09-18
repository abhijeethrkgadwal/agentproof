# AgentProof

Adaptive verification for the agentic web.

AgentProof is a research prototype that issues dynamic interaction challenges, keeps ground truth on the server, signs challenge metadata, prevents replay, collects minimal telemetry, and returns an explainable **interaction risk score** with an allow / step_up / restrict decision.

**Important:** AgentProof does **not** claim to be “AI-proof” or to prove that a user is human. The goal is adaptive, measurable resistance to automated interaction — making abuse more expensive and less reliable while remaining low-friction for legitimate users.

## Why traditional CAPTCHA is not enough

Classical CAPTCHAs assume a hard human/AI boundary that is collapsing. Static puzzles leak answers, are farmed, and do not produce calibrated risk signals. AgentProof treats verification as a **server-authoritative, time-bound, one-time challenge** with transparent risk bands — one layer in a broader anti-automation strategy (aligned with OWASP layered controls).

## Architecture

```text
Browser (untrusted)                 Server (authoritative)
─────────────────                   ──────────────────────
POST /api/challenge          ────>  Issue scene identity + cookie
                             <────  (no motion segments)
POST /api/challenge/start    ────>  lifecycle → active
POST /api/challenge/frame    ────>  poses @ server elapsed only
Canvas paints progressive poses
POST /api/verify             ────>  session + lifecycle + window
                                    + HMAC/replay + ground truth + risk
                             <────  allow | step_up | restrict
```

| Concern | Location |
|--------|----------|
| Challenge generation | `lib/challenge/` |
| HMAC signing, nonce, expiry, replay | `lib/security/` |
| Risk rules | `lib/risk/` |
| Telemetry sanitize | `lib/telemetry/` |
| In-memory store (Redis/Postgres-ready interface) | `lib/storage/` |
| APIs | `app/api/{challenge,verify,health}` |
| Demo UI | `app/demo`, `components/agentproof/` |

Phase 1 ships **one** challenge family: **temporal object tracking**.

## Threat model (Phase 1)

See [`docs/THREAT-MODEL.md`](docs/THREAT-MODEL.md) for the fuller write-up.

In scope:

- Forged or tampered challenge tokens
- Replay of a successful (or attempted) verification
- Expired challenges
- Client-side “I solved it” claims
- Brute-force object guessing on a single challenge
- Excessive API request rates (basic limiter)

Out of scope for Phase 1:

- Sophisticated browser agents / red-team automation (Phase 2)
- Distributed botnets, residential proxies, human farms
- Device fingerprinting, WebAuthn, ML anomaly models

Product thesis (locked): AgentProof does not try to prove that a user is “human.” It evaluates **interaction risk** for a specific session and can escalate when risk is high.

## Challenge lifecycle

1. Client `POST /api/challenge` → **issued** scene identity only (no motion segments). Session cookie set.
2. Client `POST /api/challenge/start` → **active**; server begins wall-clock window.
3. Client polls `POST /api/challenge/frame` → progressive poses at server elapsed time (no future plan).
4. After minimum active window, client `POST /api/verify` with selection + cookie + token.
5. Server checks signature → session → lifecycle → active duration → replay → ground truth → risk → **submitted**.

Phase 2 offline derive-from-segments is broken by design: issued JSON is not a complete solvable motion plan.


## Verification flow

Security checks (fail closed):

- Zod request validation
- HMAC-SHA256 signature (`AGENTPROOF_SIGNING_SECRET`) with constant-time compare
- Challenge ID / nonce / session binding
- Expiration
- One-time consumption (replay → 409)
- Server-side ground-truth comparison
- Rate limiting

## Risk scoring

Rule-based **interaction risk score** ∈ [0, 1]. This is **not** “probability of being human.”

| Band | Score | Decision |
|------|-------|----------|
| LOW | 0.00–0.29 | allow |
| MEDIUM | 0.30–0.69 | step_up |
| HIGH | 0.70–1.00 | restrict |

Factors include incorrect answer, failed attempts, retries, too-fast completion, sparse/excessive interaction, and stale challenges. A normal successful interaction is designed to land in LOW.

## Security assumptions

- Signing secret stays only on the server
- In-memory store is single-process (fine for local MVP; not multi-instance durable)
- Client telemetry is untrusted and sanitized
- Motion paths are visible to the client (necessary to render); the **label** of the correct object is not

## Known limitations

- Motion segments are sent to the browser — a sophisticated client could compute direction changes locally (Phase 2 measures this)
- In-memory store resets on process restart; no Redis/Postgres yet
- Rate limiter is per-process and best-effort
- Single challenge family; no adaptive sequencing yet
- No accessibility alternative challenge path yet

## Local development

```bash
cp .env.example .env.local
# set AGENTPROOF_SIGNING_SECRET to a long random string

npm install
npm run dev -- --port 43123
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

Health: `GET /api/health` → `{ "status": "ok", "service": "agentproof" }`.

## Test commands

```bash
npm test           # Vitest unit/integration
npm run test:e2e   # Playwright end-to-end
npm run lint
npm run build
```

## Environment

See `.env.example`:

- `AGENTPROOF_SIGNING_SECRET` (required)
- `DATABASE_URL` (reserved for future Prisma/Postgres)
- Optional TTL / rate-limit knobs

## Roadmap

1. **Phase 1 (this repo):** temporal challenge + signed verify loop + risk + tests
2. **Phase 2:** attacker/red-team evaluation against the challenge (browser agents)
3. **Phase 3:** adaptive difficulty / sequences
4. **Phase 4:** platform hardening (WebAuthn option, orgs, durable stores)

## License

Private research prototype.
