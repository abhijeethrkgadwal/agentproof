# AgentProof Developer Integration

## Environments

| Environment | Purpose |
|-------------|---------|
| `test` | Local / CI / staging keys |
| `live` | Production keys |

Create a project and keys via `POST /api/developer`:

```bash
# Create project
curl -X POST http://127.0.0.1:43123/api/developer \
  -H 'content-type: application/json' \
  -d '{"action":"create_project","name":"Acme Checkout"}'

# Create test key (secret shown once)
curl -X POST http://127.0.0.1:43123/api/developer \
  -H 'content-type: application/json' \
  -d '{"action":"create_key","projectId":"proj_…","environment":"test"}'
```

## Embeddable SDK

```html
<script src="/agentproof-sdk.js"></script>
<script>
  const ap = AgentProof.create({ baseUrl: "https://your-host" });
  // Prefer server-side verification for production.
</script>
```

See also `examples/integration.html`.

## Server-side verification (recommended)

1. Your backend calls `POST /api/challenge` with optional `apiKey` / `projectId` / `environment`.
   - **test** (default): key optional (demo/Lab).
   - **live**: valid `live` API key required (`X-AgentProof-Key` or body `apiKey`).
   - Invalid / revoked keys are rejected with `401 invalid_api_key` (never silently ignored).
2. Browser runs Start → progressive `/frame` → user selects.
3. Browser or backend calls `POST /api/verify` with session cookie + token.
4. Trust only the server `verified` + `decision` fields.

## Storage backends

| `AGENTPROOF_STORAGE_BACKEND` | Behavior |
|------------------------------|----------|
| `memory` (default) | Process-local stores (dev/tests) |
| `redis` | Challenge / session / rate-limit in Redis (`AGENTPROOF_REDIS_URL`) |

Replay protection requires a shared store in multi-process deployments — use Redis.
