# AgentProof case study

**Label:** Research Prototype - not production security infrastructure.  
**Repo:** [github.com/abhijeethrkgadwal/agentproof](https://github.com/abhijeethrkgadwal/agentproof)  
**Credit:** Abhijeeth Gadwal - Product & Architecture

## Vision

Automated agents increasingly attack or bypass the gates in front of core services - logins, APIs, and other high-value endpoints. The wrong response is to claim “prove you are human” or “AI-proof CAPTCHA.”

AgentProof’s research question:

> Can we make automated access **more expensive**, **less reliable**, and **more detectable**, while keeping legitimate interaction usable - and leave room for **human supervision** before sensitive actions?

`riskScore` is an explainable **interaction risk signal** (`allow` / `step_up` / `restrict`). It is not a probability that the user is human.

## Problem

- Static or fully client-described challenges can be solved offline.
- Traditional CAPTCHAs leak structure that scripts exploit.
- Agentic browsing raises the stakes for endpoints that still need accountability.

## Hypothesis

If ground truth stays server-side, frames are display-distorted, sessions are bound and short-lived, and verify uses explainable interaction features (challenge-aware), then automated solvers become less reliable and more expensive - without claiming AI-proof security.

## What shipped (portfolio slice)

| Phase | Outcome |
|-------|---------|
| 1-3 | Temporal prototype → break it offline → redesign protocol (no motion plans in payload) |
| 4-5 | Agent Lab + light harden + regression gates |
| 6-7 | Study pilot UX, Lab V2 attacks, Redis-ready stores, adaptive rules, SDK path |
| 8 | Validation, honest limitations, public research framing |
| 9 | Natural challenges: drag-avoid, physical, dynamic-path |
| 10 | Challenge-aware risk rules so pointer-heavy solves are not over-punished |

## Architecture

Server issues signed challenges and sessions; clients poll progressive `/frame` poses; `/verify` alone decides pass/fail with a rule DecisionEngine. Storage is memory or Redis. See [`architecture.md`](./architecture.md).

## Threat model

Network observers, offline derivation, replay/tamper, polling reconstruction, timing attacks, API key abuse. Notes in [`threat-model.md`](./threat-model.md) and [`security.md`](./security.md).

## Benchmarks & honesty

Lab Automation Cost and attack matrices are **measurements**, not proof of human-only access. Human study remains an observational pilot with honest N. See [`limitations.md`](./limitations.md) and [`human-study.md`](./human-study.md).

## Lessons learned

1. Shipping motion plans to the client fails immediately against offline solvers.
2. Display≠GT raises cost but adaptive attackers can still partially undo noise - structured bias helped.
3. Separate hard security gates from measurement attacks in CI.
4. Honest human N beats fabricated study claims.
5. Risk rules tuned for click challenges over-punish natural pointer streams - make them challenge-aware.

## Open source

MIT-licensed for experimentation. Fork the demos, attack them in Agent Lab, and propose better challenges or risk rules - while keeping research-honest claims.

## Roadmap (not promises)

Broader human pilots, independent accessibility audit, hardened key management, richer Lab attackers for natural challenges - only if pursued deliberately. Optional ML/Jev for risk adaptation remains out of scope unless explicitly greenlit.
