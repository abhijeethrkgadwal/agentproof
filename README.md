# AgentProof

Adaptive verification for the agentic web.

AgentProof issues dynamic interaction challenges, keeps ground truth on the server, signs challenge + session metadata, prevents replay, and returns an explainable **interaction risk score** (`allow` / `step_up` / `restrict`).

**Important:** AgentProof does **not** claim to be “AI-proof” or to prove that a user is human.

## Phase 7 highlights

- Polling-optimisation residual suppressed (display lag + path contamination + GT-biased warp that survives adaptive low-pass)
- Storage abstractions: memory (default) or Redis (`AGENTPROOF_STORAGE_BACKEND=redis`)
- Signed short-lived sessions (`agentproof_sid` HMAC cookie + SessionStore)
- Adaptive `RuleDecisionEngine` (timing / retries / cadence / interaction rules) — no ML / Jev
- Developer projects + API keys + embeddable SDK (`/agentproof-sdk.js`)
- Study aggregate panel + accessibility notes

## Quick start

```bash
cp .env.example .env.local
# set AGENTPROOF_SIGNING_SECRET

npm install
npm run dev -- --port 43123 --hostname 127.0.0.1
```

- [Demo](http://127.0.0.1:43123/demo) · [Study](http://127.0.0.1:43123/study) · [Lab](http://127.0.0.1:43123/lab)
- [Accessible](http://127.0.0.1:43123/demo/accessible) · [SDK example](http://127.0.0.1:43123/examples/integration.html)

## Architecture

```text
Browser                     Server
──────                     ──────
POST /api/challenge  ────> signed session cookie + issued identity
POST /start,/frame   ────> progressive display poses (≠ GT math)
POST /api/verify     ────> GT check ⟂ DecisionEngine(features)
                     <──── verified + decision + risk factors
```

Multi-process: set `AGENTPROOF_STORAGE_BACKEND=redis` and `AGENTPROOF_REDIS_URL`.

## Automation Cost

Experimental metric only:

`timeToSolveMs/1000 + 0.5*interactionCount + 0.1*framesObserved + 0.05*apiRequestCount`

## Docs

- [`docs/developer-integration.md`](docs/developer-integration.md)
- [`docs/agent-lab.md`](docs/agent-lab.md)
- [`docs/human-study.md`](docs/human-study.md)
- [`docs/threat-model.md`](docs/threat-model.md)
- [`docs/accessibility.md`](docs/accessibility.md)

## Tests

```bash
npm test && npm run lint && npm run build
PLAYWRIGHT_PORT=43123 npm run test:e2e
npm run lab:gates -- http://127.0.0.1:43123
```

## Roadmap

1–6 delivered (challenge → Lab V2 → human study).  
7 — production hardening + residual suppress (this).  
8 — not started.

## License

Private research prototype.
