import type { FastifyReply } from "fastify";
import type { z } from "zod";

/** Parses a request body against a schema, or sends a 400 and returns undefined. */
export async function parseBody<T extends z.ZodType>(
  schema: T,
  body: unknown,
  reply: FastifyReply,
): Promise<z.output<T> | undefined> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    await reply.code(400).send({
      error: "Invalid request body",
      issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    });
    return undefined;
  }
  return parsed.data;
}
