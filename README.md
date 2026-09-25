# AgentProof

**Make automated access expensive and detectable.**

Open-source **research / portfolio prototype** for adaptive interaction risk on the agentic web.

It does **not** claim to be AI-proof, and it does **not** claim to prove that someone is human.

Canonical repo: [github.com/abhijeethrkgadwal/agentproof](https://github.com/abhijeethrkgadwal/agentproof)

## Why it exists

Automated agents can scrape, script, and replay their way toward core endpoints (logins, APIs, high-value actions). Static challenges leak enough structure to solve offline. “Prove you are human” is the wrong product promise.

AgentProof explores a different approach:

1. Keep **ground truth on the server**
2. Issue short-lived, signed interaction challenges
3. Measure **interaction risk** and **automation cost**
4. Return **allow / step_up / restrict** so humans can supervise sensitive access

The aim is measurable friction against automated abuse - not impossible challenges.

## Try it

```bash
cp .env.example .env.local
# set AGENTPROOF_SIGNING_SECRET to a long random string

npm install
npm run dev -- --port 43123 --hostname 127.0.0.1
```

- [Demo hub](http://127.0.0.1:43123/demo) - natural challenges first; temporal research last
- [Drag & Avoid](http://127.0.0.1:43123/demo/drag-avoid) · [Physical](http://127.0.0.1:43123/demo/physical) · [Dynamic Path](http://127.0.0.1:43123/demo/dynamic-path)
- [Temporal (research)](http://127.0.0.1:43123/demo/temporal) · [Accessible temporal](http://127.0.0.1:43123/demo/accessible)
- [Agent Lab](http://127.0.0.1:43123/lab) · [Study](http://127.0.0.1:43123/study) · [Challenge lab](http://127.0.0.1:43123/challenge-lab) (dev)
- [SDK example](http://127.0.0.1:43123/examples/integration.html)

Optional Redis (multi-process / soak):

```bash
export AGENTPROOF_STORAGE_BACKEND=redis
export AGENTPROOF_REDIS_URL=redis://127.0.0.1:6379
npm run soak:redis
```

## What you get

| Surface | Purpose |
|---------|---------|
| Natural challenges (v0.2) | Drag / physics / path experiments people can actually try |
| Temporal (research) | Original observe-and-select security baseline |
| Accessible path | Keyboard / list version of temporal (pilot, not WCAG-certified) |
| Agent Lab | Measure automated attacks and automation cost |
| Risk engine | Explainable `riskScore` → allow · step_up · restrict |

## Architecture (short)

```text
ISSUE → START → ACTIVE → INTERACT → VERIFY → CONSUME → DECISION
```

- HMAC-signed challenge + session
- Progressive `/frame` poses (display ≠ ground-truth math)
- Client success flags are never trusted
- Challenge-aware rule DecisionEngine (no ML by default)

Details: [`docs/architecture.md`](docs/architecture.md), [`docs/security.md`](docs/security.md).

## Docs

**Start here (humans visiting / hiring / reviewing):**

- [`docs/case-study.md`](docs/case-study.md) - problem, vision, what shipped
- [`docs/limitations.md`](docs/limitations.md) - what not to claim
- [`docs/challenges-v02.md`](docs/challenges-v02.md) - natural challenge UX notes
- [`docs/accessibility.md`](docs/accessibility.md) - accessible path status

**Builders / red-team:**

- [`docs/architecture.md`](docs/architecture.md)
- [`docs/security.md`](docs/security.md)
- [`docs/threat-model.md`](docs/threat-model.md)
- [`docs/agent-lab.md`](docs/agent-lab.md)
- [`docs/developer-integration.md`](docs/developer-integration.md)
- [`docs/human-study.md`](docs/human-study.md)

## Tests

```bash
npm test
npm run lint
npm run build
npm run test:e2e
npm run lab:gates -- http://127.0.0.1:43123
```

## Credit

**Abhijeeth Gadwal** - Product & Architecture  
[GitHub](https://github.com/abhijeethrkgadwal) · [LinkedIn](https://www.linkedin.com/in/abhijeethrkgadwal)

## License

[MIT](LICENSE) - fork it, break it in the Lab, and propose improvements. Keep research-honest framing: measure cost and risk; do not invent AI-proof claims.
