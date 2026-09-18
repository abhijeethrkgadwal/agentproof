export type ChallengeType = "temporal";

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

/** Full object plan — retained only in server storage. */
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

/** Client-visible object identity at issue time — no motion plan. */
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
};

export type TemporalGroundTruth = {
  correctObjectId: string;
  requiredDirectionChanges: number;
  directionChangeCounts: Record<string, number>;
};

export type StoredChallenge = {
  challengeId: string;
  sessionId: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  difficulty: number;
  challengeType: ChallengeType;
  /** Full motion plan + instruction — never returned wholesale to clients. */
  renderConfiguration: TemporalRenderConfiguration;
  groundTruth: TemporalGroundTruth;
  lifecycle: ChallengeLifecycle;
  startedAt?: string;
  framePollCount: number;
  /** Last display poses (for EMA smoothing — not ground truth). */
  lastDisplayPoses?: ObjectPose[];
  lastDisplayElapsedMs?: number;
  consumed: boolean;
  failedAttempts: number;
};

/** Issued challenge response — no segments / starts / requiredDirectionChanges field. */
export type PublicChallengeResponse = {
  challengeId: string;
  token: string;
  challengeType: ChallengeType;
  sessionId: string;
  expiresAt: string;
  difficulty: number;
  instruction: string;
  lifecycle: ChallengeLifecycle;
  scene: PublicScene;
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
