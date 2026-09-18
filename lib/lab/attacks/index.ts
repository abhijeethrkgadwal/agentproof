import { runDirectApiAttack } from "@/lib/lab/attacks/directApiAttack";
import { runFrameReconstructionV2 } from "@/lib/lab/attacks/frameReconstructionV2";
import { runPollingOptimisation } from "@/lib/lab/attacks/pollingOptimisation";
import { runReplayTampering } from "@/lib/lab/attacks/replayTampering";
import { runStateInference } from "@/lib/lab/attacks/stateInference";
import { runTimingAttack } from "@/lib/lab/attacks/timingAttack";
import { appendAttackRun } from "@/lib/lab/attackStore";
import type { AttackName, AttackRunRecord } from "@/lib/lab/types";

export const LAB_V2_ATTACKS: AttackName[] = [
  "frame_reconstruction_v2",
  "polling_optimisation",
  "timing_attack",
  "direct_api_attack",
  "state_inference",
  "replay_tampering",
];

export async function runLabV2Attack(
  name: AttackName,
  options: { baseUrl: string; difficulty?: number },
): Promise<AttackRunRecord> {
  let result: Omit<AttackRunRecord, "runId" | "timestamp">;
  switch (name) {
    case "frame_reconstruction_v2":
      result = await runFrameReconstructionV2(options);
      break;
    case "polling_optimisation":
      result = await runPollingOptimisation({
        ...options,
        intervalsMs: [120, 250, 450],
      });
      break;
    case "timing_attack":
      result = await runTimingAttack(options);
      break;
    case "direct_api_attack":
      result = await runDirectApiAttack(options);
      break;
    case "state_inference":
      result = await runStateInference(options);
      break;
    case "replay_tampering":
      result = await runReplayTampering(options);
      break;
    default: {
      const _exhaustive: never = name;
      throw new Error(`unknown_attack:${_exhaustive}`);
    }
  }
  return appendAttackRun(result);
}

export async function runAllLabV2Attacks(options: {
  baseUrl: string;
  difficulty?: number;
}): Promise<AttackRunRecord[]> {
  const out: AttackRunRecord[] = [];
  for (const name of LAB_V2_ATTACKS) {
    out.push(await runLabV2Attack(name, options));
  }
  return out;
}
