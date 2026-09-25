#!/usr/bin/env node
/**
 * Human pilot recruitment script (Phase 8).
 * Prints a reproducible invite + checklist for 30-50 voluntary participants.
 * Does not fabricate results. Records ops readiness + any local pilot N.
 *
 * Usage: node scripts/study/recruitment.mjs
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR =
  process.env.ATTACK_EVIDENCE_DIR ??
  "/cursor/stores/bc-4c601bd1-025b-48a3-bcf8-1f47197d27b5/media";
const ATTEMPTS = join(process.cwd(), "data", "study", "attempts.json");

const INVITE = `# AgentProof observational pilot - recruitment invite

**Label:** Observational pilot - not a scientific human-performance study.
**Product label:** Research Prototype - not production security infrastructure.

## Who
Voluntary adults who can use a keyboard and a modern browser. No compensation required for this research prototype; participation is optional.

## What you will do (~3-5 minutes)
1. Open the study URL: {STUDY_URL}
2. Read consent (anonymous ID only - no name/email)
3. Complete difficulty 1, then difficulty 2
4. Optionally use the accessibility / list presentation
5. Done - only aggregate stats are published

## Privacy
- Anonymous participant ID you choose (letters, numbers, _, -)
- Metrics: success, time, retries, frames, interactions, a11y path, abandonment
- No fingerprinting, keystroke logging, clipboard, location, or facial data

## Target N
30-50 participants. If fewer complete in a given window, report honest N - do not fabricate.

## Accessibility
Prefer \`/demo/accessible\` or the study's list presentation checkbox if you use assistive tech.
`;

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const studyUrl =
    process.env.STUDY_URL ?? "http://127.0.0.1:43123/study";
  const invite = INVITE.replaceAll("{STUDY_URL}", studyUrl);

  let attempts = [];
  if (existsSync(ATTEMPTS)) {
    try {
      attempts = JSON.parse(readFileSync(ATTEMPTS, "utf8"));
    } catch {
      attempts = [];
    }
  }
  const participants = new Set(
    (Array.isArray(attempts) ? attempts : []).map((a) => a.participantId),
  );

  const ops = {
    phase: 8,
    label: "Observational pilot - not a scientific human-performance study.",
    productLabel:
      "research prototype - not production security infrastructure",
    targetN: "30-50",
    obtainedN: participants.size,
    attempts: Array.isArray(attempts) ? attempts.length : 0,
    studyUrl,
    uxScaleReady: true,
    checklist: [
      "Consent gate + anonymous ID validation",
      "Difficulty 1 then 2 sequence",
      "Abandon path records abandoned:true",
      "Accessibility list presentation toggle",
      "Aggregate panel (no individual rows public)",
      "Recruitment invite template shipped",
    ],
    honestNote:
      participants.size === 0
        ? "No participants obtained in this agent session. UX/ops are scale-ready; recruit externally using the invite."
        : `Honest N=${participants.size} from local attempts.json - not fabricated to target.`,
    invitePath: join(OUT_DIR, "phase-8-recruitment-invite.md"),
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(join(OUT_DIR, "phase-8-recruitment-invite.md"), invite);
  writeFileSync(
    join(OUT_DIR, "phase-8-human-pilot-ops.json"),
    JSON.stringify(ops, null, 2),
  );
  console.log(JSON.stringify(ops, null, 2));
  console.log("\n--- INVITE ---\n");
  console.log(invite);
}

main();
