import type { ChallengeType } from "@/lib/challenge/types";
import type { ChallengeModuleMeta } from "@/lib/challenge/core/types";

const A11Y_DISCLAIMER =
  "This is a pilot accessibility implementation and is not WCAG-certified.";

/** Client-safe challenge metadata (no Node crypto / generators). */
export const CHALLENGE_META: Record<ChallengeType, ChallengeModuleMeta> = {
  temporal: {
    type: "temporal",
    label: "Temporal (Research)",
    shortDescription: "Original research challenge — observe direction changes.",
    instructionDefault:
      "Select the object that changed direction the required times.",
    accessibility: {
      summary: "Equivalent structured selection without visual tracking.",
      disclaimer: A11Y_DISCLAIMER,
      mode: "temporal_select",
    },
    usesFrames: true,
  },
  drag_avoid: {
    type: "drag_avoid",
    label: "Dynamic Drag & Avoid",
    shortDescription: "Drag to the target while avoiding moving obstacles.",
    instructionDefault:
      "Drag the blue object to the green target without hitting the moving obstacles.",
    accessibility: {
      summary:
        "Discrete keyboard nudges with live position announcements (same validation).",
      disclaimer: A11Y_DISCLAIMER,
      mode: "keyboard_sequence",
    },
    usesFrames: true,
  },
  physical: {
    type: "physical",
    label: "Physical Interaction",
    shortDescription:
      "Place the red block without knocking the blue block off.",
    instructionDefault:
      "Place the red block on the platform without knocking the blue block off.",
    accessibility: {
      summary: "Discrete nudges with live announcements (same validation).",
      disclaimer: A11Y_DISCLAIMER,
      mode: "structured_input",
    },
    usesFrames: true,
  },
  dynamic_path: {
    type: "dynamic_path",
    label: "Dynamic Path",
    shortDescription: "Guide the ball through moving gate openings.",
    instructionDefault: "Guide the ball through the opening.",
    accessibility: {
      summary: "Discrete nudges with live opening announcements (same validation).",
      disclaimer: A11Y_DISCLAIMER,
      mode: "structured_input",
    },
    usesFrames: true,
  },
};

export const ALL_CHALLENGE_TYPES: ChallengeType[] = [
  "temporal",
  "drag_avoid",
  "physical",
  "dynamic_path",
];
