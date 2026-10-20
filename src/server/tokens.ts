import { createHash, randomBytes } from "node:crypto";

/** A new random secret for a session or a device credential. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

// Only a hash of each token is stored, so a leaked database can't be used to sign in or impersonate a device.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}
