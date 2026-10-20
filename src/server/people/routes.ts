import type { FastifyInstance } from "fastify";
import type { People } from "./people.js";

const sessionCookie = "star_chart_session";
const cookieOptions = { path: "/", httpOnly: true, secure: true, sameSite: "lax" } as const;

export async function peopleRoutes(app: FastifyInstance, people: People) {
  app.post<{ Body: { email: string; password: string; chartName: string; timeZone: string } }>(
    "/api/sign-up",
    async (request, reply) => {
      const token = await people.signUp(request.body);
      reply.setCookie(sessionCookie, token, cookieOptions);
      return reply.code(201).send({});
    },
  );

  app.post<{ Body: { email: string; password: string } }>("/api/sign-in", async (request, reply) => {
    const token = await people.signIn(request.body);
    if (!token) return reply.code(401).send({ error: "email or password is wrong" });
    reply.setCookie(sessionCookie, token, cookieOptions);
    return {};
  });

  app.post("/api/sign-out", async (request, reply) => {
    const token = request.cookies[sessionCookie];
    if (token) await people.signOut(token);
    reply.clearCookie(sessionCookie, cookieOptions);
    return reply.code(204).send();
  });

  app.get("/api/me", async (request, reply) => {
    const token = request.cookies[sessionCookie];
    const signedIn = token ? await people.whoIs(token) : undefined;
    if (!signedIn) return reply.code(401).send({ error: "not signed in" });
    const { grownUp, chart } = signedIn;
    return { grownUp: { email: grownUp.email, role: grownUp.role }, chart };
  });
}
