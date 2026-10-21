import type { FastifyInstance } from "fastify";
import { requireGrownUp } from "../people/authenticate.js";
import type { People } from "../people/people.js";
import type { Notifications } from "./notifications.js";

export async function notificationRoutes(
  app: FastifyInstance,
  people: People,
  notifications: Notifications,
  vapidPublicKey: string,
) {
  // Browsers need our public key to subscribe.
  app.get("/api/push/public-key", async () => ({ publicKey: vapidPublicKey }));

  app.post<{ Body: { endpoint: string; keys: { p256dh: string; auth: string } } }>(
    "/api/push/subscriptions",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            endpoint: { type: "string", pattern: "^https://", maxLength: 1000 },
            keys: {
              type: "object",
              properties: {
                p256dh: { type: "string", minLength: 1, maxLength: 200 },
                auth: { type: "string", minLength: 1, maxLength: 100 },
              },
              required: ["p256dh", "auth"],
              additionalProperties: false,
            },
            // Browsers include this (usually null); it isn't needed.
            expirationTime: { type: ["number", "null"] },
          },
          required: ["endpoint", "keys"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      await notifications.subscribe(signedIn.grownUp.id, request.body);
      return reply.code(201).send({});
    },
  );

  app.post<{ Body: { delaySeconds?: number } }>(
    "/api/push/test",
    {
      schema: {
        body: {
          type: "object",
          properties: { delaySeconds: { type: "integer", minimum: 1, maximum: 300 } },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      const noDevices = { error: "No devices have notifications turned on for you yet." };
      if (request.body.delaySeconds) {
        // Later, so the grown-up can close the app first: phones often don't show a notification for the open app.
        const later = await notifications.testLater(signedIn.grownUp.id, request.body.delaySeconds * 1000);
        if (later.devices === 0) return reply.code(409).send(noDevices);
        return reply.code(202).send({ devices: later.devices, sendsAt: later.sendsAt.toISOString() });
      }
      const result = await notifications.test(signedIn.grownUp.id);
      if (result.devices === 0) return reply.code(409).send(noDevices);
      return result;
    },
  );

  app.get("/api/push/subscriptions", async (request, reply) => {
    const signedIn = await requireGrownUp(people, request, reply);
    if (!signedIn) return reply;
    return { subscriptions: await notifications.subscriptionsOf(signedIn.grownUp.id) };
  });

  app.delete<{ Body: { endpoint: string } }>(
    "/api/push/subscriptions",
    {
      schema: {
        body: {
          type: "object",
          properties: { endpoint: { type: "string", maxLength: 1000 } },
          required: ["endpoint"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      await notifications.unsubscribe(signedIn.grownUp.id, request.body.endpoint);
      return reply.code(204).send();
    },
  );
}
