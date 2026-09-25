export type ChallengeType =
  | "temporal"
  | "drag_avoid"
  | "physical"
  | "dynamic_path";

export type ChallengeLifecycle =
  | "issued"
  | "started"
  | "active"
  | "submitted";

export type ShapeKind = "circle" | "square" | "triangle" | "diamond" | "hexagon";

export type Vec2 = { x: number; y: number };

/** A motion segment: constant velocity until `endMs`. Server-only. */
export type MotionSegment = {
  endMs: number;
  velocity: Vec2;
};

/** Full object plan - retained only in server storage (temporal). */
export type RenderObject = {
  id: string;
  shape: ShapeKind;
  color: string;
  size: number;
  start: Vec2;
  segments: MotionSegment[];
};

export type TemporalRenderConfiguration = {
  width: number;
  height: number;
  durationMs: number;
  instruction: string;
  requiredDirectionChanges: number;
  objects: RenderObject[];
};

/** Client-visible object identity at issue time - no motion plan. */
export type PublicSceneObject = {
  id: string;
  shape: ShapeKind;
  color: string;
  size: number;
};

export type PublicScene = {
  width: number;
  height: number;
  durationMs: number;
  objects: PublicSceneObject[];
};

export type ObjectPose = {
  id: string;
  shape: ShapeKind;
  color: string;
  size: number;
  x: number;
  y: number;
  rotation?: number;
  role?: string;
};

export type TemporalGroundTruth = {
  correctObjectId: string;
  requiredDirectionChanges: number;
  directionChangeCounts: Record<string, number>;
};

/* ─── Drag & Avoid (v0.2) ─── */

export type DragAvoidObstaclePlan = {
  id: string;
  size: number;
  start: Vec2;
  segments: MotionSegment[];
};

export type DragAvoidRenderConfiguration = {
  width: number;
  height: number;
  durationMs: number;
  instruction: string;
  agent: { id: string; size: number; color: string; start: Vec2 };
  target: { id: string; size: number; color: string; position: Vec2 };
  /** Server-only obstacle motion plans. */
  obstacles: DragAvoidObstaclePlan[];
};

export type DragAvoidGroundTruth = {
  agentId: string;
  targetId: string;
  targetRadius: number;
  maxSpeedPxPerSec: number;
  collisionPadding: number;
  /** Accessible fallback: sequence of safe corridor labels. */
  accessibleSafePath: string[];
};

/* ─── Physical Interaction (v0.2) ─── */

export type PhysicalBody = {
  id: string;
  role: "agent" | "protected" | "static";
  color: string;
  width: number;
  height: number;
  start: Vec2;
  rotation: number;
  draggable: boolean;
};

export type PhysicalPlatform = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PhysicalRenderConfiguration = {
  width: number;
  height: number;
  durationMs: number;
  instruction: string;
  bodies: PhysicalBody[];
  platform: PhysicalPlatform;
  protectedBounds: { x: number; y: number; width: number; height: number };
};

export type PhysicalGroundTruth = {
  agentId: string;
  protectedId: string;
  platformId: string;
  /** Accessible: ordered placement keys (e.g. left/center/right). */
  accessiblePlacementKey: string;
  maxAgentSpeed: number;
};

/* ─── Dynamic Path (v0.2) ─── */

export type DynamicGatePlan = {
  id: string;
  /** Vertical center of the opening over time. */
  openingCenterStart: number;
  openingHeight: number;
  gateThickness: number;
  x: number;
  segments: MotionSegment[];
};

export type DynamicPathRenderConfiguration = {
  width: number;
  height: number;
  durationMs: number;
  instruction: string;
  ball: { id: string; size: number; color: string; start: Vec2 };
  gates: DynamicGatePlan[];
  goalX: number;
};

export type DynamicPathGroundTruth = {
  ballId: string;
  goalX: number;
  maxSpeedPxPerSec: number;
  /** Accessible: discrete gate timing choices. */
  accessibleGateSlots: number[];
};

export type ChallengeRenderConfiguration =
  | TemporalRenderConfiguration
  | DragAvoidRenderConfiguration
  | PhysicalRenderConfiguration
  | DynamicPathRenderConfiguration;

export type ChallengeGroundTruth =
  | TemporalGroundTruth
  | DragAvoidGroundTruth
  | PhysicalGroundTruth
  | DynamicPathGroundTruth;

export type StoredChallenge = {
  challengeId: string;
  sessionId: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  difficulty: number;
  challengeType: ChallengeType;
  /** Full private config - never returned wholesale to clients. */
  renderConfiguration: ChallengeRenderConfiguration;
  groundTruth: ChallengeGroundTruth;
  lifecycle: ChallengeLifecycle;
  startedAt?: string;
  framePollCount: number;
  /** Last display poses (temporal EMA / interaction frames). */
  lastDisplayPoses?: ObjectPose[];
  lastDisplayElapsedMs?: number;
  consumed: boolean;
  failedAttempts: number;
};

/** Issued challenge response - no segments / starts / GT fields. */
export type PublicChallengeResponse = {
  challengeId: string;
  token: string;
  challengeType: ChallengeType;
  sessionId: string;
  expiresAt: string;
  difficulty: number;
  instruction: string;
  lifecycle: ChallengeLifecycle;
  scene: PublicScene & {
    /** Interaction challenges may include static layout hints (no future plans). */
    layout?: Record<string, unknown>;
  };
  accessibilityHint?: string;
};

export type FrameResponse = {
  challengeId: string;
  lifecycle: ChallengeLifecycle;
  elapsedMs: number;
  durationMs: number;
  complete: boolean;
  poses: ObjectPose[];
  instruction: string;
};

export function isTemporalChallenge(
  challenge: StoredChallenge,
): challenge is StoredChallenge & {
  challengeType: "temporal";
  renderConfiguration: TemporalRenderConfiguration;
  groundTruth: TemporalGroundTruth;
} {
  return challenge.challengeType === "temporal";
}

export function isDragAvoidChallenge(
  challenge: StoredChallenge,
): challenge is StoredChallenge & {
  challengeType: "drag_avoid";
  renderConfiguration: DragAvoidRenderConfiguration;
  groundTruth: DragAvoidGroundTruth;
} {
  return challenge.challengeType === "drag_avoid";
}

export function isPhysicalChallenge(
  challenge: StoredChallenge,
): challenge is StoredChallenge & {
  challengeType: "physical";
  renderConfiguration: PhysicalRenderConfiguration;
  groundTruth: PhysicalGroundTruth;
} {
  return challenge.challengeType === "physical";
}

export function isDynamicPathChallenge(
  challenge: StoredChallenge,
): challenge is StoredChallenge & {
  challengeType: "dynamic_path";
  renderConfiguration: DynamicPathRenderConfiguration;
  groundTruth: DynamicPathGroundTruth;
} {
  return challenge.challengeType === "dynamic_path";
}

export function getChallengeDurationMs(challenge: StoredChallenge): number {
  return challenge.renderConfiguration.durationMs;
}

export function getChallengeInstruction(challenge: StoredChallenge): string {
  return challenge.renderConfiguration.instruction;
}
