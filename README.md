# AgentProof

Adaptive verification for the agentic web.

**Research/portfolio prototype — not production security infrastructure.**

AgentProof issues dynamic interaction challenges, keeps ground truth on the server, signs challenge + session metadata, prevents replay, and returns an explainable **interaction risk score** (`allow` / `step_up` / `restrict`).

It does **not** claim to be “AI-proof” or to prove that a user is human.

## Phase 8 highlights

- Redis multi-process soak (`npm run soak:redis`) + boot-time storage init
- Final Lab benchmark matrix (Phases 2–7 comparisons)
- Human pilot UX/ops + recruitment script (honest N)
- SDK/API security review (invalid keys rejected; live requires live key)
- Accessibility validation notes + public docs / case study
- Landing polish with Security + Genesis links

## Quick start

```bash
cp .env.example .env.local
# set AGENTPROOF_SIGNING_SECRET

npm install
npm run dev -- --port 43123 --hostname 127.0.0.1
```

- [Demo](http://127.0.0.1:43123/demo) · [Study](http://127.0.0.1:43123/study) · [Lab](http://127.0.0.1:43123/lab)
- [Accessible](http://127.0.0.1:43123/demo/accessible) · [SDK example](http://127.0.0.1:43123/examples/integration.html)

## Redis (optional)

```bash
export AGENTPROOF_STORAGE_BACKEND=redis
export AGENTPROOF_REDIS_URL=redis://127.0.0.1:6379
npm run soak:redis
```

For HTTP cross-instance soak, run two Next.js servers and set `SOAK_BASE_A` / `SOAK_BASE_B`.

## Architecture

```text
Browser                     Server
──────                     ──────
POST /api/challenge  ────> signed session cookie + issued identity
POST /start,/frame   ────> progressive display poses (≠ GT math)
POST /api/verify     ────> GT check ⟂ DecisionEngine(features)
                     <──── verified + decision + risk factors
```

## Automation Cost

Experimental metric only:

`timeToSolveMs/1000 + 0.5*interactionCount + 0.1*framesObserved + 0.05*apiRequestCount`

## Docs

- [`docs/security.md`](docs/security.md)
- [`docs/architecture.md`](docs/architecture.md)
- [`docs/agent-lab.md`](docs/agent-lab.md)
- [`docs/human-study.md`](docs/human-study.md)
- [`docs/limitations.md`](docs/limitations.md)
- [`docs/case-study.md`](docs/case-study.md)
- [`docs/accessibility.md`](docs/accessibility.md)
- [`docs/developer-integration.md`](docs/developer-integration.md)

## Tests

```bash
npm test && npm run lint && npm run build
PLAYWRIGHT_PORT=43123 npm run test:e2e
npm run lab:gates -- http://127.0.0.1:43123
npm run lab:benchmark -- http://127.0.0.1:43123
```

## Roadmap

1–7 delivered (challenge → Lab V2 → study → harden + Redis/SDK).  
8 — validation + public release (this).  
9 — not started.

## License

Private research prototype.
