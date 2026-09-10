import { z } from "zod";

export const numberSchema = z.coerce.number().int();

export const stringSchema = z.string();

/** A trace id, matching what the write path validates (`z.uuid()` in prompt.type.ts). */
export const uuidSchema = z.uuid();

/**
 * A SESSION identifier, which is not a UUID and must not be validated as one.
 *
 * Three shapes are legitimate and all three reach the same read. Our own sessions use a
 * derived UUID. An ingested trace with no `gen_ai.conversation.id` is a session of one
 * trace, identified by a 32-hex OTLP trace id. And an ingested conversation is identified
 * by the sender's own `gen_ai.conversation.id`, which the GenAI conventions constrain in
 * no way at all -- real senders use `sess_…`, ULIDs, plain integers.
 *
 * Guarded as a UUID, the last two 400 and ingested traces are stored but unreadable, which
 * is what this replaces. The value is only ever a bound query parameter and every read is
 * scoped by org and project, so the guard exists to bound the input, not to sanitise it:
 * non-empty, length-capped, and no control characters (which would only ever arrive by
 * accident or mischief and would corrupt a log line).
 */
export const sessionIdSchema = z
	.string()
	.min(1)
	.max(200)
	.refine(
		(value) =>
			![...value].some((char) => {
				const code = char.charCodeAt(0);
				return code < 0x20 || code === 0x7f;
			}),
		{ message: "Session id must not contain control characters" },
	);

export const dateSchema = z.coerce.date();
