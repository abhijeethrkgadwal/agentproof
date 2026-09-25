# Limitations

**Label:** Research Prototype - not production security infrastructure.

## Security limitations

- Not AI-proof; vision models, human farms, and novel solvers remain in scope.
- Display harden raises Automation Cost; it does not eliminate frame-reconstruction risk.
- Memory backend is single-process only - replay protection does not span instances without Redis.
- API keys are file-backed demo storage, not a hardened KMS / multi-tenant IAM.
- Demo `/api/challenge` remains open in **test** without a key (intentional for Lab/study).
- No formal penetration test or bug bounty in this phase.

## Evaluation limitations

- Human pilot target is 30-50; sessions may report honest N ≪ target.
- Observational pilot ≠ scientific human-performance study.
- Lab Automation Cost is an experimental formula, not a universal security score.
- L3 vision is a stub interface only (no model integration by design).

## Accessibility limitations

- `/demo/accessible` is an equivalent list path, not a full WCAG 2.2 AA claim.
- Canvas path is not fully keyboard-operable; use the list / accessible demo.
- No independent screen-reader certification in this phase.

## Operational limitations

- Redis soak validates shared state; production ops (TLS Redis, failover, auth ACLs) are out of scope.
- No SLA, multi-region, or abuse-operations console.
- Public docs and demos may lag experimental branches - prefer `main` on GitHub.

## What not to claim

Do not claim production readiness, AI-proof verification, full WCAG conformance, or enterprise security certification based on this prototype alone.
