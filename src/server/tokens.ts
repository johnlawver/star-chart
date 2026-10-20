import { createHash, randomBytes } from "node:crypto";

/** A new random secret for a session or a device credential. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

// Only a hash of each token is stored, so a leaked database can't be used to sign in or impersonate a device.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

// No 0/O, 1/I/L or other look-alikes, so a code can be read off a screen and typed without mistakes.
const pairingAlphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** A short code for a person (or a camera) to copy from one device to another. */
export function newPairingCode(length = 8): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => pairingAlphabet[byte % pairingAlphabet.length]).join("");
}

/** The code printed as a ticket's QR code: opaque and unguessable, but short enough to type into a fake scanner. */
export function newTicketCode(): string {
  return `SC-${newPairingCode(12)}`;
}
