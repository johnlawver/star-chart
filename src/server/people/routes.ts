import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../app.js";
import { requireGrownUp, sessionCookie, sessionCookieOptions as cookieOptions } from "./authenticate.js";
import type { People } from "./people.js";

export async function peopleRoutes(app: FastifyInstance, people: People, config: AppConfig) {
  app.post<{ Body: { email: string; password: string; chartName: string; timeZone: string } }>(
    "/api/sign-up",
    async (request, reply) => {
      if (!config.allowNewCharts) return reply.code(403).send({ error: "new charts can't be created on this server" });
      const result = await people.signUp(request.body);
      if ("refused" in result) {
        if (result.refused === "email-in-use") return reply.code(409).send({ error: "that email is already in use" });
        return reply.code(400).send({ error: "that isn't a time zone we recognise" });
      }
      reply.setCookie(sessionCookie, result.token, cookieOptions);
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
    const signedIn = await requireGrownUp(people, request, reply);
    if (!signedIn) return reply;
    const { grownUp, chart } = signedIn;
    return { grownUp: { email: grownUp.email, role: grownUp.role }, chart };
  });
}
