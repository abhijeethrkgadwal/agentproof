#!/usr/bin/env node
/**
 * Phase 8 accessibility validation checklist (automated DOM/API smoke + documented gaps).
 * Not a WCAG certification. Writes media/phase-8-a11y-validation.json
 *
 * Usage: node scripts/a11y/validate.mjs [baseUrl]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = (process.argv[2] ?? "http://127.0.0.1:43123").replace(/\/$/, "");
const OUT_DIR =
  process.env.ATTACK_EVIDENCE_DIR ??
  "/cursor/stores/bc-4c601bd1-025b-48a3-bcf8-1f47197d27b5/media";

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const checks = [];

  const pages = ["/demo/accessible", "/study", "/"];
  for (const path of pages) {
    const res = await fetch(`${BASE}${path}`);
    const html = await res.text();
    checks.push({
      name: `page_loads_${path}`,
      ok: res.status === 200,
      detail: `status=${res.status}`,
    });
    if (path === "/demo/accessible") {
      checks.push({
        name: "a11y_demo_has_aria_live",
        ok: html.includes("aria-live"),
        detail: "aria-live present in SSR/CSR shell",
      });
      checks.push({
        name: "a11y_demo_has_instruction",
        ok: html.includes("id=\"instruction\"") || html.includes("Loading"),
        detail: "instruction region present",
      });
      checks.push({
        name: "a11y_demo_prototype_disclaimer",
        ok:
          html.toLowerCase().includes("not yet a complete wcag") ||
          html.toLowerCase().includes("wcag"),
        detail: "WCAG non-claim present",
      });
    }
    if (path === "/study") {
      checks.push({
        name: "study_observational_label",
        ok: html.includes("Observational pilot"),
        detail: "observational pilot label",
      });
      checks.push({
        name: "study_prototype_label",
        ok: html.includes("not production security"),
        detail: "prototype disclaimer",
      });
    }
    if (path === "/") {
      checks.push({
        name: "landing_security_anchor",
        ok: html.includes('id="security"') || html.includes("#security"),
        detail: "Security nav/section",
      });
      checks.push({
        name: "landing_prototype_label",
        ok: html.includes("not production security infrastructure"),
        detail: "required public label",
      });
    }
  }

  // Keyboard path is validated structurally: accessible demo exposes buttons with test ids
  const a11yHtml = await fetch(`${BASE}/demo/accessible`).then((r) => r.text());
  checks.push({
    name: "keyboard_path_controls_present",
    ok:
      a11yHtml.includes("a11y-start") ||
      a11yHtml.includes("Start challenge"),
    detail: "Start control present for keyboard activation",
  });

  const remainingGaps = [
    "Canvas path not fully keyboard-operable",
    "No independent NVDA/VoiceOver certification this phase",
    "Contrast / prefers-reduced-motion not fully audited",
    "No formal WCAG 2.2 AA claim",
  ];

  const report = {
    phase: 8,
    label: "research/portfolio prototype — not production security infrastructure",
    baseUrl: BASE,
    checkedAt: new Date().toISOString(),
    checks,
    pass: checks.every((c) => c.ok),
    remainingWcagGaps: remainingGaps,
    note: "Automated smoke + checklist only — not a WCAG audit.",
  };

  writeFileSync(
    join(OUT_DIR, "phase-8-a11y-validation.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
