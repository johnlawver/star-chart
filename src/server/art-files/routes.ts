import type { FastifyInstance } from "fastify";
import { requireGrownUp } from "../people/authenticate.js";
import type { People } from "../people/people.js";
import { largestPicture, pictureTypeOf, pictureTypes, type ArtFiles, type PictureType } from "./art-files.js";

// Scripts never run in a served SVG, even if someone opens its address directly; styles inside it still apply.
const svgPolicy = "default-src 'none'; style-src 'unsafe-inline'; script-src 'none'; sandbox";

export async function artFileRoutes(app: FastifyInstance, people: People, artFiles: ArtFiles) {
  // Pictures arrive as the request's body, with their own content type.
  app.addContentTypeParser([...pictureTypes], { parseAs: "buffer", bodyLimit: largestPicture }, (_request, body, done) => done(null, body));

  // An owner or admin uploads a picture, such as a sticker for their store.
  app.post("/api/art-files", { bodyLimit: largestPicture }, async (request, reply) => {
    const signedIn = await requireGrownUp(people, request, reply);
    if (!signedIn) return reply;
    if (signedIn.grownUp.role === "grown-up") return reply.code(403).send({ error: "Ask an admin to add pictures." });
    const declared = String(request.headers["content-type"] ?? "").split(";")[0]!.trim().toLowerCase();
    if (!pictureTypes.includes(declared as PictureType)) {
      return reply.code(415).send({ error: "upload a PNG, WebP, JPEG or SVG picture" });
    }
    const bytes = request.body as Buffer;
    const actual = pictureTypeOf(bytes);
    if (actual !== declared) return reply.code(400).send({ error: "that file isn't the picture it says it is" });
    return reply.code(201).send(await artFiles.save(signedIn.chart.id, actual, bytes));
  });

  // Anyone with a picture's address can see it: screens show pictures in plain <img> tags, which can't send a device's
  // credential. Addresses are unguessable, and stickers aren't private.
  app.get<{ Params: { id: string } }>("/api/art-files/:id", async (request, reply) => {
    const file = await artFiles.get(request.params.id);
    if (!file) return reply.code(404).send({ error: "no such picture" });
    reply.header("content-type", file.contentType);
    reply.header("cache-control", "public, max-age=31536000, immutable");
    reply.header("x-content-type-options", "nosniff");
    if (file.contentType === "image/svg+xml") reply.header("content-security-policy", svgPolicy);
    return reply.send(file.bytes);
  });
}
