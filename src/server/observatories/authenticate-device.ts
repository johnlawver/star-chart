import type { FastifyReply, FastifyRequest } from "fastify";
import type { DeviceKind } from "../database.js";
import type { Observatories, PairedDevice } from "./observatories.js";

/** The credential a device sent in its Authorization header, if any. */
export function deviceToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
}

/**
 * The paired device making this request, or undefined after replying 401.
 * Like grown-ups, a device's chart always comes from its credential, never from the request.
 */
export async function requireDevice(
  observatories: Observatories,
  kind: DeviceKind,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<PairedDevice | undefined> {
  const token = deviceToken(request);
  const device = token ? await observatories.deviceFor(token) : undefined;
  if (!device || device.kind !== kind) {
    await reply.code(401).send({ error: "not a paired device" });
    return undefined;
  }
  return device;
}
