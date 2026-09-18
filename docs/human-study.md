# Human Study Methodology

## Purpose

Collect an honest **observational pilot** baseline of legitimate users solving AgentProof temporal challenges, for comparison with Agent Lab automation metrics.

## Labels (required)

> Observational pilot — not a scientific human-performance study.

> Research/portfolio prototype — not production security infrastructure.

Do not use these results as product claims of human performance or “AI-proof” verification.

## Recruitment (Phase 8)

```bash
npm run study:recruit
```

Produces `phase-8-recruitment-invite.md` + `phase-8-human-pilot-ops.json`. Target **30–50** voluntary participants; if fewer complete, report **honest N** (never fabricate).

## Flow (`/study`)

1. Consent text (no PII collection commitment)
2. Anonymous participant ID (alphanumeric / `_` / `-` only)
3. Difficulty 1 challenge, then difficulty 2
4. Optional accessibility-style list presentation
5. Thank-you — no public individual results

## Fields collected

- participantId (anonymous)
- challengeId
- difficulty
- success / failure
- completionTimeMs
- retryCount
- interactionEventCount
- framesObserved
- accessibilityPathUsed
- timestamp
- abandoned (if session ended early)

## Aggregates (public)

- participant count
- attempts
- success rate
- median / P95 completion time
- abandonment rate
- median retries
- median interaction events

Individual attempt rows are **not** exposed by `/api/study/aggregate`.

## Privacy

No name, email, location, fingerprinting, keystroke logging, clipboard, facial recognition, or unnecessary device IDs.
