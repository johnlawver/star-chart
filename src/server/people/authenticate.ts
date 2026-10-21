import type { FastifyReply, FastifyRequest } from "fastify";
import type { SignedInGuest } from "./guests.js";
import type { People, SignedInGrownUp } from "./people.js";

export const sessionCookie = "star_chart_session";
export const sessionCookieOptions = { path: "/", httpOnly: true, secure: true, sameSite: "lax" } as const;

/** Whoever is signed in: a grown-up, or a guest with a Guest PIN. */
export type SignedInActor = ({ kind: "grown-up" } & SignedInGrownUp) | ({ kind: "guest" } & SignedInGuest);

async function whoIsSignedIn(people: People, request: FastifyRequest): Promise<SignedInActor | undefined> {
  const token = request.cookies[sessionCookie];
  if (!token) return undefined;
  const grownUp = await people.whoIs(token);
  if (grownUp) return { kind: "grown-up", ...grownUp };
  const guest = await people.guests.whoIs(token);
  return guest ? { kind: "guest", ...guest } : undefined;
}

/**
 * The signed-in grown-up for this request, or undefined after replying 401 (nobody) or 403 (a guest, who can only
 * handle tickets). Every grown-up endpoint uses this, and takes the chart from it, never from the request,
 * so nobody can reach another chart's data.
 */
export async function requireGrownUp(
  people: People,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<SignedInGrownUp | undefined> {
  const actor = await whoIsSignedIn(people, request);
  if (!actor) {
    await reply.code(401).send({ error: "not signed in" });
    return undefined;
  }
  if (actor.kind === "guest") {
    await reply.code(403).send({ error: "Guests can only handle tickets." });
    return undefined;
  }
  return actor;
}

/** Like requireGrownUp, but lets guests in too: only for handling tickets and lost-ticket requests. */
export async function requireActor(
  people: People,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<SignedInActor | undefined> {
  const actor = await whoIsSignedIn(people, request);
  if (!actor) {
    await reply.code(401).send({ error: "not signed in" });
    return undefined;
  }
  return actor;
}

/** Who to record as having made a decision. */
export function decidedBy(actor: SignedInActor): { grownUpId: string } | { guest: true } {
  return actor.kind === "grown-up" ? { grownUpId: actor.grownUp.id } : { guest: true };
}
