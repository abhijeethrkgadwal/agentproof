# AgentProof

Adaptive verification for the agentic web.

**Research/portfolio prototype — not production security infrastructure.**

AgentProof issues dynamic interaction challenges, keeps ground truth on the server, signs challenge + session metadata, prevents replay, and returns an explainable **interaction risk score** (`allow` / `step_up` / `restrict`).

It does **not** claim to be “AI-proof” or to prove that a user is human.

## Versions

### AgentProof v0.1 — Research/security foundation

Temporal challenge, progressive frames, HMAC/session/replay gates, Agent Lab V2, study pilot, Redis-ready stores, SDK path, Phase 8 validation.

### AgentProof v0.2 — Natural interaction challenge experiments

Adds **Dynamic Drag & Avoid**, **Physical Interaction**, and **Dynamic Path** on the same server-authoritative stack. Temporal remains the original research challenge at `/demo/temporal`.

**v0.2 is an experimental challenge UX release and is not production security infrastructure.**

See [`docs/challenges-v02.md`](docs/challenges-v02.md).

## Quick start

```bash
cp .env.example .env.local
# set AGENTPROOF_SIGNING_SECRET

npm install
npm run dev -- --port 43123 --hostname 127.0.0.1
```

- [Demo hub](http://127.0.0.1:43123/demo) · [Temporal](http://127.0.0.1:43123/demo/temporal) · [Drag & Avoid](http://127.0.0.1:43123/demo/drag-avoid)
- [Physical](http://127.0.0.1:43123/demo/physical) · [Dynamic Path](http://127.0.0.1:43123/demo/dynamic-path)
- [Challenge lab](http://127.0.0.1:43123/challenge-lab) · [Study](http://127.0.0.1:43123/study) · [Lab](http://127.0.0.1:43123/lab)
- [Accessible](http://127.0.0.1:43123/demo/accessible) · [SDK example](http://127.0.0.1:43123/examples/integration.html)

## Redis (optional)

```bash
export AGENTPROOF_STORAGE_BACKEND=redis
export AGENTPROOF_REDIS_URL=redis://127.0.0.1:6379
npm run soak:redis
```

## Architecture

```text
Browser                     Server
──────                     ──────
POST /api/challenge  ────> signed session cookie + issued identity
POST /start,/frame   ────> progressive display poses (≠ GT math)
POST /api/verify     ────> GT check ⟂ DecisionEngine(features)
                     <──── verified + decision + risk factors
```

Challenge types: `temporal` | `drag_avoid` | `physical` | `dynamic_path`.

## Automation Cost

Experimental metric only:

`timeToSolveMs/1000 + 0.5*interactionCount + 0.1*framesObserved + 0.05*apiRequestCount`

## Docs

- [`docs/challenges-v02.md`](docs/challenges-v02.md)
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
```

## Roadmap

1–8 delivered (challenge → Lab V2 → study → harden + Redis/SDK → validation).  
9 — natural challenge lab (this).

## License

Private research prototype.
