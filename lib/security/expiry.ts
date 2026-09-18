export function isExpired(expiresAt: string | Date, now: Date = new Date()): boolean {
  const expiry = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  if (Number.isNaN(expiry.getTime())) {
    return true;
  }
  return now.getTime() >= expiry.getTime();
}

export function computeExpiresAt(ttlMs: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + ttlMs);
}

export function ageMs(issuedAt: string | Date, now: Date = new Date()): number {
  const issued = typeof issuedAt === "string" ? new Date(issuedAt) : issuedAt;
  return Math.max(0, now.getTime() - issued.getTime());
}
