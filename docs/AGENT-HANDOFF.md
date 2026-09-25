# AgentProof — Agent Handoff (read this first)

**Last updated:** 2026-09-25  
**Canonical repo (source of truth):** https://github.com/abhijeethrkgadwal/agentproof  
**Default branch tip (verified):** `2eb51cb` — *Fix natural challenge freeze from frame rate limiting*  
**Status:** Research / portfolio prototype — **not** production security infrastructure  

If you are a new agent starting from this GitHub repo, this file is your continuity document. Do not restart Phase 1 from scratch.

---

## 1. What AgentProof is

AgentProof is an **adaptive human / automation verification platform** for the agentic web.

It does **not** claim to prove someone is human, and it does **not** claim to be “AI-proof.”

It assesses **interaction risk**, keeps **ground truth server-side**, and makes automated abuse more expensive and less reliable while keeping legitimate human interaction low-friction.

Central principle:

> Do not try to make AgentProof impossible for AI to solve. Make it measurable, adaptive, expensive to automate, difficult to replay, and low-friction for legitimate users.

`riskScore` must never be described as “probability the user is human.” It is an **explainable interaction risk signal**.

---

## 2. Roles & workflow

- **Abhijeeth Gadwal** — Product Manager + Solution Architect  
- **Cursor agents** — engineering delivery  
- Build **incrementally**; each phase must be runnable and testable  
- **Do not** integrate Jev / ML unless Abhijeeth explicitly greenlights it (and respect TypeSafe MCA: do not benchmark Jev against AgentProof without permission)  
- Ground-truth verification and risk scoring must stay **separate**

---

## 3. What has shipped (Phases 1–9)

### Phase 1 — Core prototype
- Next.js + TypeScript temporal challenge demo
- Server-generated challenges, HMAC signing, nonce, expiry, one-time consume
- Risk engine + allow / step_up / restrict
- Vitest + Playwright

### Phase 2 — Break AgentProof
- Offline derive from client motion segments → **100/100** solve in &lt;100ms
- HMAC/replay held
- Measured, did **not** patch blindly

### Phase 3 — Protocol redesign
- Removed future motion plans from issued payload
- Progressive `/frame` on server clock
- Lifecycle: issued → start → active → verify → consume
- Session cookie binding
- Offline solve → **0/100**

### Phase 4 — Agent Lab
- L1 API observer / L2 Playwright / L3 stub
- Automation Cost metric
- Residual: frame-trail observation (~5s) still viable but noisy

### Phase 5 — Light harden + Lab gates
- Display poses ≠ GT (wobble/quantize/lag later refined)
- Lab regression gates
- Decision **C**: light harden + Lab gates, then Jev later (Jev still not done)

### Phase 6 — Human study + Lab V2
- `/study` observational pilot (anonymous; not scientific study)
- Stronger attacks A–F; polling-optimisation residual measured
- FeatureSnapshot + `DecisionEngine` / `RuleDecisionEngine`

### Phase 7 — Production hardening
- Polling residual suppressed (display lag/contamination/GT-biased warp)
- Redis-ready stores, signed sessions, adaptive rules, API keys + SDK
- Origin Genesis PRs #1–#2 merged historically

### Phase 8 — Validation + public release
- Redis soak PASS, SDK P0s fixed, docs/case study/landing polish
- Human pilot honest N=0 (ops ready for 30–50)
- Label everywhere: research/portfolio prototype

### Phase 9 — v0.2 Natural Challenge Lab (additive)
- Shared challenge architecture
- New challenges: **drag-avoid**, **physical**, **dynamic-path**
- Temporal preserved as original research (`/demo/temporal`)
- Demo hub, `/challenge-lab`, a11y fallbacks (pilot)
- Freeze fixes: RAF/pose loops, trajectory clocks, **frame rate-limit 429 freeze** (`2eb51cb`)
- Merged to Origin then synced to GitHub `main`

---

## 4. Current product surface

| Route | Purpose |
|-------|---------|
| `/` | Landing |
| `/demo` | Challenge hub |
| `/demo/temporal` | Original research temporal challenge |
| `/demo/drag-avoid` | Drag blue → green, avoid movers |
| `/demo/physical` | Place red on platform w/o knocking blue |
| `/demo/dynamic-path` | Guide ball through moving openings |
| `/demo/accessible` | Temporal accessible path (pilot) |
| `/study` | Human observational pilot |
| `/lab` | Agent Lab dashboard |
| `/challenge-lab` | Internal UX comparison (dev only) |

Local run:

```bash
cp .env.example .env.local
# set AGENTPROOF_SIGNING_SECRET to a long random string
npm install
npm run dev -- --port 43123 --hostname 127.0.0.1
```

Required: `AGENTPROOF_SIGNING_SECRET`. Redis optional for basic local run (`AGENTPROOF_STORAGE_BACKEND=memory` default).

---

## 5. Security architecture (do not regress)

```text
ISSUE → START → ACTIVE → INTERACTION → VERIFY → CONSUME → DECISION
```

- Server-authoritative ground truth  
- HMAC / nonce / expiry / replay  
- Session binding  
- No future trajectories / GT in issued or frame payloads  
- Client success flags never trusted  
- `npm run lab:gates` must keep passing  

---

## 6. Known gaps / next work candidates

1. **Risk rules over-punish natural challenges**  
   Pointer-heavy drags create many `interaction` events → `excessive_interaction` (+ too_fast stacks) → HIGH/restrict even when `verified: true`. Engine was tuned for temporal. Needs challenge-type-aware weights — **not** ML/Jev by default.

2. **Human pilot N still ~0** — recruit 30–50 if pursuing UX claims; keep “observational pilot” label.

3. **Accessibility** — pilot only; not WCAG-certified.

4. **Natural challenge attackers** — Lab placeholders; no fake benchmarks.

5. **Git remotes** — GitHub is SoT. Old Cursor Origin Project may still clone Origin; prefer working from this GitHub repo.

6. **Windows case clash** — `docs/THREAT-MODEL.md` vs `docs/threat-model.md` can collide on case-insensitive FS.

---

## 7. Explicit non-goals (unless PM says otherwise)

- Do not integrate Jev or ML  
- Do not claim AI-proof  
- Do not redesign Phase 3 protocol for fun  
- Do not delete temporal / Phase 1–8 surfaces  
- Do not invent benchmark numbers  

---

## 8. Suggested next milestones (PM to choose)

A. Fix risk scoring for natural challenges (rule weights by `challengeType`)  
B. Real human pilot (30–50) + report  
C. Implement real Lab attackers for drag/physical/path  
D. Portfolio polish only (case study / demos)  
E. Later: Jev for risk/adaptation only — never GT — if terms allow  

---

## 9. Key docs in repo

- `README.md`  
- `docs/challenges-v02.md`  
- `docs/case-study.md`  
- `docs/architecture.md`  
- `docs/security.md`  
- `docs/threat-model.md` / `docs/THREAT-MODEL.md`  
- `docs/agent-lab.md`  
- `docs/human-study.md`  
- `docs/limitations.md`  
- `docs/developer-integration.md`  

---

## 10. Kickoff prompt for a new agent

Paste this into a new chat opened on the GitHub repo:

```text
You are continuing AgentProof from the GitHub repo https://github.com/abhijeethrkgadwal/agentproof (main).

Read docs/AGENT-HANDOFF.md first. Do not restart from Phase 1.

Canonical SoT is this GitHub repo. Product principle: risk assessment + cost-of-automation, not “prove human” / not “AI-proof”.

Current state: Phases 1–9 shipped. Temporal + drag-avoid + physical + dynamic-path work. Tip should include 2eb51cb rate-limit freeze fix.

Known priority gap: RuleDecisionEngine over-punishes pointer-heavy natural solves (excessive_interaction / too_fast) even when verified=true.

Ask me which next milestone to take (risk-weight fix, human pilot, Lab attackers, portfolio polish, or something else). Do not add Jev/ML unless I explicitly request it.
```
