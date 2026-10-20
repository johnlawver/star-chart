import type { FastifyInstance } from "fastify";
import { iconLibrary } from "./icons.js";

export async function iconRoutes(app: FastifyInstance) {
  app.get("/api/icons", async () => ({ icons: iconLibrary.list() }));

  app.get<{ Params: { file: string } }>("/api/icons/:file", async (request, reply) => {
    const id = request.params.file.replace(/\.svg$/, "");
    const svg = iconLibrary.svg(id);
    if (!svg) return reply.code(404).send({ error: "no such icon" });
    return reply.type("image/svg+xml").header("cache-control", "public, max-age=86400").send(svg);
  });
}
