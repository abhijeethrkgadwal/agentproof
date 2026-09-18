# AgentProof — Phase 1 Threat Model

Adapted from the local research prototype notes; scoped to Phase 1 only.

## Assets

- Challenge integrity (nonce, expiry, ground truth)
- Verification decision (allow / step_up / restrict)
- HMAC signing secret
- API availability
- Minimal interaction telemetry

## Adversaries

- Scripted bots and HTTP clients
- Playwright / Selenium automation
- Client-side tampering (token forgery, answer claims)
- Replay attackers
- (Later phases) OCR / vision / multimodal browser agents

## Threats and mitigations

### 1. Challenge replay

**Mitigation:** short TTL + one-time consumption + nonce binding + challenge ID checks.

### 2. Client-side answer forgery

**Mitigation:** ground truth stays server-side; browser never authoritative for pass/fail.

### 3. Challenge / token tampering

**Mitigation:** HMAC-SHA256 over challenge metadata; constant-time signature compare.

### 4. Brute-force object guessing

**Mitigation:** consume challenge after a verify attempt; rate limiting on challenge/verify APIs.

### 5. High-volume automation

**Mitigation (Phase 1):** basic in-memory rate limiter. Production needs edge/WAF and shared limits.

### 6. Behaviour simulation

**Mitigation:** do not rely on a single behavioural signal; Phase 2 benchmarks real agents against the same challenges.

### 7. Accessibility exclusion

**Mitigation (planned):** alternate challenge paths. Not implemented in Phase 1.

## Known Phase 1 limitations

- In-memory challenge store (single process; not durable / not multi-instance)
- Motion paths are sent to the client for rendering — a sophisticated client can derive direction changes locally
- Rule-based risk only; no ML
- No Redis, WebAuthn, or Agent Evaluation Lab yet
