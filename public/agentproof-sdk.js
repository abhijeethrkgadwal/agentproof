/**
 * Minimal embeddable AgentProof browser SDK (Phase 7).
 * Usage:
 *   const ap = AgentProof.create({ baseUrl, apiKey? });
 *   const challenge = await ap.createChallenge({ difficulty: 1 });
 *   await ap.start(challenge);
 *   const frame = await ap.frame(challenge);
 *   const result = await ap.verify(challenge, objectId, telemetry);
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.AgentProof = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  function create(options) {
    const baseUrl = (options.baseUrl || "").replace(/\/$/, "");
    const apiKey = options.apiKey || null;

    async function post(path, body) {
      const headers = { "Content-Type": "application/json" };
      if (apiKey) headers["X-AgentProof-Key"] = apiKey;
      const res = await fetch(baseUrl + path, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(body || {}),
      });
      const json = await res.json().catch(function () {
        return {};
      });
      return { status: res.status, json };
    }

    return {
      createChallenge: function (opts) {
        return post("/api/challenge", {
          difficulty: (opts && opts.difficulty) || 1,
          environment: (opts && opts.environment) || "test",
          projectId: opts && opts.projectId,
          apiKey: apiKey || undefined,
        });
      },
      start: function (challenge) {
        return post("/api/challenge/start", {
          challengeId: challenge.challengeId || challenge.json.challengeId,
          token: challenge.token || challenge.json.token,
        });
      },
      frame: function (challenge) {
        return post("/api/challenge/frame", {
          challengeId: challenge.challengeId || challenge.json.challengeId,
          token: challenge.token || challenge.json.token,
        });
      },
      verify: function (challenge, selectedObjectId, telemetry) {
        return post("/api/verify", {
          challengeId: challenge.challengeId || challenge.json.challengeId,
          token: challenge.token || challenge.json.token,
          selectedObjectId: selectedObjectId,
          telemetry: telemetry || {},
        });
      },
    };
  }

  return { create: create };
});
