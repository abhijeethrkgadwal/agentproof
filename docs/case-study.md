# AgentProof case study

**Label:** Research/portfolio prototype — not production security infrastructure.

## Problem

Agentic clients can solve static or fully client-described challenges offline. Traditional CAPTCHAs leak enough structure for scripts; “prove you are human” claims do not hold against modern automation.

## Market context

Bot defense and agentic browsing are converging. Buyers want measurable friction against automated abuse without pretending vision models do not exist. Portfolio research can explore adaptive, server-authored challenges with honest metrics.

## Hypothesis

If ground truth and motion plans stay server-side, frames are display-distorted, and verify decisions use explainable interaction features, then automated solvers become less reliable and more expensive — without claiming AI-proof security.

## Architecture

Server issues signed challenges and sessions; clients poll progressive `/frame` poses; `/verify` alone decides pass/fail with a rule DecisionEngine. Storage is memory or Redis. See [`architecture.md`](./architecture.md).

## Threat model

Network observers, offline derivation, replay/tamper, polling reconstruction, timing attacks, API key abuse. Full notes in [`threat-model.md`](./threat-model.md) and [`security.md`](./security.md).

## Phase 2 attack

Public payloads included motion segments. Attackers reconstructed answers offline. Attack matrix documented under media `phase-2-attack-matrix.json`.

## Phase 3 redesign

Removed client motion plans; progressive server frames; signed sessions; premature verify blocked. Retest artifact: `phase-3-attack-retest.json`.

## Phase 4 Agent Lab

L1/L2 runners and Automation Cost metric. Lab dashboard separates measurement from hard security gates.

## Phase 5 hardening (Decision C)

Display harden + risk engine; no Jev/ML. Focus on raising reconstruction cost.

## Phase 6 / 7 productisation

Human study UX, Lab V2 attacks A–F, regression gates, Redis abstractions, signed sessions, adaptive rules, developer keys + SDK. Phase 7 suppressed polling-optimisation residual via lag / path contamination / GT-biased warp.

## Benchmarks

Phase 8 final matrix (`phase-8-final-benchmark.json`) re-runs live checks and Lab V2, and references historical artifacts. Automated results are **lab measurements** — not proof of human-only access.

## Human pilot

Observational pilot at `/study` (difficulties 1–2, anonymous IDs). Target 30–50; report honest N. See [`human-study.md`](./human-study.md) and recruitment script `scripts/study/recruitment.mjs`.

## Limitations

See [`limitations.md`](./limitations.md). Prototype is not production security infrastructure.

## Lessons learned

1. Shipping motion plans to the client fails immediately against offline solvers.
2. Display≠GT is necessary but insufficient; adaptive low-pass can undo high-frequency noise — Phase 7 needed structured bias.
3. Separate hard security gates from measurement attacks in CI.
4. Honest human N beats fabricated study claims.
5. Redis TTL APIs must match the client library (ioredis EX args).

## Roadmap

Phases 1–8 delivered for this portfolio slice. Future work (not started here): broader pilots, independent a11y audit, hardened key management, optional protocol evolution — **no Phase 9 in this session**.
