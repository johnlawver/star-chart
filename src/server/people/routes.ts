import type { FastifyInstance } from "fastify";
import type { People } from "./people.js";

const sessionCookie = "star_chart_session";

export async function peopleRoutes(app: FastifyInstance, people: People) {
  app.post<{ Body: { email: string; password: string; chartName: string; timeZone: string } }>(
    "/api/sign-up",
    async (request, reply) => {
      const token = await people.signUp(request.body);
      reply.setCookie(sessionCookie, token, { path: "/", httpOnly: true, secure: true, sameSite: "lax" });
      return reply.code(201).send({});
    },
  );

  app.get("/api/me", async (request, reply) => {
    const token = request.cookies[sessionCookie];
    const signedIn = token ? await people.whoIs(token) : undefined;
    if (!signedIn) return reply.code(401).send({ error: "not signed in" });
    const { grownUp, chart } = signedIn;
    return { grownUp: { email: grownUp.email, role: grownUp.role }, chart };
  });
}
