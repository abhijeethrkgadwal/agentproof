#!/usr/bin/env node
/**
 * CLI: run Agent Lab V2 attacks A-F
 * Usage: node scripts/lab/run-lab-v2.mjs [baseUrl] [attack|all]
 */
const BASE = (process.argv[2] ?? "http://127.0.0.1:43123").replace(/\/$/, "");
const ATTACK = process.argv[3] ?? "all";

async function main() {
  const res = await fetch(`${BASE}/api/lab/v2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attack: ATTACK, difficulty: 1 }),
  });
  const json = await res.json();
  if (!res.ok) {
    console.error(json);
    process.exit(1);
  }
  console.log(JSON.stringify(json, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
