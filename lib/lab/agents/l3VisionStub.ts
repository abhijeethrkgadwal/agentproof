/**
 * Level 3 - Vision agent interface stub.
 * No model is integrated in Phase 4. This defines the contract for a future
 * multimodal agent that would consume canvas frames / screenshots.
 */

export type VisionFrame = {
  /** ISO timestamp when the frame was captured. */
  capturedAt: string;
  /** Elapsed ms since challenge start (client estimate). */
  elapsedMs: number;
  /** PNG/JPEG bytes or data-URL - opaque to the lab until a model is wired. */
  imageBase64?: string;
  /** Optional width/height metadata. */
  width?: number;
  height?: number;
};

export type VisionAgentContext = {
  challengeId: string;
  instruction: string;
  difficulty: number;
  frames: VisionFrame[];
};

export type VisionAgentDecision = {
  selectedObjectId: string | null;
  confidence: number;
  rationale: string;
  modelId: string;
};

export interface VisionAgent {
  readonly id: string;
  readonly status: "stub" | "ready";
  analyze(context: VisionAgentContext): Promise<VisionAgentDecision>;
}

/** Placeholder agent - always refuses until a real model is plugged in. */
export class StubVisionAgent implements VisionAgent {
  readonly id = "vision-stub-v0";
  readonly status = "stub" as const;

  async analyze(context: VisionAgentContext): Promise<VisionAgentDecision> {
    void context;
    return {
      selectedObjectId: null,
      confidence: 0,
      rationale:
        "Phase 4 stub only - no multimodal model integrated. Wire a vision/agent model here in a later phase.",
      modelId: this.id,
    };
  }
}

export function createVisionAgentStub(): VisionAgent {
  return new StubVisionAgent();
}
