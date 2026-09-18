# AgentProof

Adaptive verification for the agentic web.

AgentProof is a research prototype that issues dynamic interaction challenges, keeps ground truth on the server, signs challenge metadata, prevents replay, collects minimal telemetry, and returns an explainable **interaction risk score** with an allow / step_up / restrict decision.

**Important:** AgentProof does **not** claim to be “AI-proof” or to prove that a user is human. The goal is adaptive, measurable resistance to automated interaction — making abuse more expensive and less reliable while remaining low-friction for legitimate users.

## Phase 6 objectives

- Real **human study** observational pilot at `/study` (anonymous, consent-gated)
- **Agent Lab V2** attacks A–F with persisted attack runs
- Normalized **feature snapshots** + `DecisionEngine` / `RuleDecisionEngine` (no ML / Jev)
- Regression gates for blocked security properties
- Pilot accessibility path (not a full WCAG audit)

Docs: [`docs/human-study.md`](docs/human-study.md) · [`docs/agent-lab.md`](docs/agent-lab.md) · [`docs/threat-model.md`](docs/threat-model.md)

## Architecture

```text
Browser (untrusted)                 Server (authoritative)
─────────────────                   ──────────────────────
POST /api/challenge          ────>  Issue scene identity + cookie
POST /api/challenge/start    ────>  lifecycle → active
POST /api/challenge/frame    ────>  display poses (≠ exact GT math)
POST /api/verify             ────>  GT check SEPARATE from DecisionEngine
                             <────  allow | step_up | restrict
                                    + feature snapshot stored
```

## Human study methodology

See [`docs/human-study.md`](docs/human-study.md). Label all results:

> Observational pilot — not a scientific human-performance study.

Aggregates only via `/api/study/aggregate`. No public individual rows. No PII.

## Agent Lab V2 & attack methodology

See [`docs/agent-lab.md`](docs/agent-lab.md).

```bash
npm run lab:l1 -- http://127.0.0.1:43123 5
npm run lab:l2
npm run lab:v2 -- http://127.0.0.1:43123 all
npm run lab:gates -- http://127.0.0.1:43123
```

Dashboard `/lab` separates **HUMAN OBSERVATIONS** (study) from **AUTOMATED ATTACKS**.

## Automation Cost definition

Normalized **experimental** metric — **not** a universal security score:

```text
AutomationCost =
  timeToSolveMs/1000
  + 0.5 * interactionCount
  + 0.1 * framesObserved
  + 0.05 * apiRequestCount
```

Defined in `lib/lab/types.ts` (`computeAutomationCost`, `AUTOMATION_COST_FORMULA`).

## Risk / decision engine

Ground-truth answer checks stay separate from risk. Scoring goes through:

- `DecisionEngine` interface (`lib/decision/types.ts`)
- `RuleDecisionEngine` (`lib/decision/ruleEngine.ts`) — deterministic rules only

Feature snapshots (`lib/features/*`) enable future engines without protocol changes. **No Jev / external AI in Phase 6.**

## Current security posture

| Property | Status |
|----------|--------|
| Offline derivation | Blocked |
| Static payload GT extraction | Blocked |
| Replay / tamper | Blocked |
| Premature / expired verify | Blocked |
| Frame-trail automation | Residual; measured by Lab V2 |

## Privacy principles

Minimal telemetry. No browser fingerprinting, keystroke logging, clipboard collection, precise location, facial recognition, or unnecessary device identifiers.

## Known limitations / what remains unsolved

- Adaptive trail filters may still recover direction changes
- L3 vision agents are stub-only
- Human-farm economics unmodeled
- Accessibility path is pilot-grade (not a complete WCAG audit)
- Single challenge family; no adaptive sequencing yet
- In-memory stores (lab/study/features) — not multi-instance durable

## Local development

```bash
cp .env.example .env.local
# set AGENTPROOF_SIGNING_SECRET

npm install
npm run dev -- --port 43123 --hostname 127.0.0.1
```

- Demo: [http://127.0.0.1:43123/demo](http://127.0.0.1:43123/demo)
- Study: [http://127.0.0.1:43123/study](http://127.0.0.1:43123/study)
- Lab: [http://127.0.0.1:43123/lab](http://127.0.0.1:43123/lab)
- Accessible: [http://127.0.0.1:43123/demo/accessible](http://127.0.0.1:43123/demo/accessible)

## Roadmap

1. Phase 1 — temporal challenge + signed verify + risk  
2. Phase 2 — attack measurement (offline derive)  
3. Phase 3 — progressive frames + lifecycle + session  
4. Phase 4 — Agent Lab L1/L2/L3 stub  
5. Phase 5 — light `/frame` harden + gates (Decision C)  
6. **Phase 6 — human study + Lab V2 + DecisionEngine** (this)  
7. Phase 7 — *not started* (adaptive policy / optional later Jev — out of scope here)

## License

Private research prototype.
