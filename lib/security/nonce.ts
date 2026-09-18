import { randomBytes } from "crypto";

/** Cryptographically secure unique nonce (hex). */
export function generateNonce(bytes = 16): string {
  return randomBytes(bytes).toString("hex");
}
