import type { FastifyReply, FastifyRequest } from "fastify";
import type { People, SignedInGrownUp } from "./people.js";

export const sessionCookie = "star_chart_session";
export const sessionCookieOptions = { path: "/", httpOnly: true, secure: true, sameSite: "lax" } as const;

/**
 * The signed-in grown-up for this request, or undefined after replying 401.
 * Every grown-up endpoint uses this, and takes the chart from it, never from the request,
 * so nobody can reach another chart's data.
 */
export async function requireGrownUp(
  people: People,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<SignedInGrownUp | undefined> {
  const token = request.cookies[sessionCookie];
  const signedIn = token ? await people.whoIs(token) : undefined;
  if (!signedIn) {
    await reply.code(401).send({ error: "not signed in" });
    return undefined;
  }
  return signedIn;
}
