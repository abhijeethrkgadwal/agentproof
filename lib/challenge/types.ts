export type ChallengeType = "temporal";

export type ShapeKind = "circle" | "square" | "triangle" | "diamond" | "hexagon";

export type Vec2 = { x: number; y: number };

/** A motion segment: constant velocity until `endMs`. */
export type MotionSegment = {
  endMs: number;
  velocity: Vec2;
};

export type RenderObject = {
  id: string;
  shape: ShapeKind;
  color: string;
  size: number;
  start: Vec2;
  /** Full motion plan — browser can animate, but answer is not marked. */
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
  renderConfiguration: TemporalRenderConfiguration;
  groundTruth: TemporalGroundTruth;
  consumed: boolean;
  failedAttempts: number;
};

export type PublicChallengeResponse = {
  challengeId: string;
  token: string;
  challengeType: ChallengeType;
  sessionId: string;
  renderConfiguration: TemporalRenderConfiguration;
  expiresAt: string;
  difficulty: number;
  instruction: string;
};
