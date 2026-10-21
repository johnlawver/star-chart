import type { FastifyInstance } from "fastify";
import { requireGrownUp } from "../people/authenticate.js";
import type { People } from "../people/people.js";
import type { QuizItem } from "../database.js";
import type { QuizPools } from "./quiz-pools.js";

const idField = { type: "string", maxLength: 36 } as const;

/** The shape of a quiz, wherever it comes from: short enough to fit on a receipt. */
export const quizBodyProperties = {
  childId: idField,
  topicId: idField,
  title: { type: "string", minLength: 1, maxLength: 60, pattern: "\\S" },
  instructions: { type: "string", maxLength: 200 },
  items: {
    type: "array",
    minItems: 1,
    maxItems: 20,
    items: {
      type: "object",
      properties: {
        prompt: { type: "string", minLength: 1, maxLength: 100, pattern: "\\S" },
        answer: { type: "string", minLength: 1, maxLength: 100, pattern: "\\S" },
      },
      required: ["prompt", "answer"],
      additionalProperties: false,
    },
  },
} as const;

export async function quizRoutes(app: FastifyInstance, people: People, quizPools: QuizPools) {
  // A grown-up writes a quiz for a child, such as this week's spelling words from school.
  app.post<{ Body: { childId: string; topicId: string; title: string; instructions: string; items: QuizItem[] } }>(
    "/api/quizzes",
    {
      schema: {
        body: {
          type: "object",
          properties: quizBodyProperties,
          required: ["childId", "topicId", "title", "instructions", "items"],
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const signedIn = await requireGrownUp(people, request, reply);
      if (!signedIn) return reply;
      const result = await quizPools.add(signedIn.chart.id, request.body);
      if ("refused" in result) return reply.code(400).send({ error: result.refused });
      return reply.code(201).send({ quiz: { id: result.id } });
    },
  );
}
