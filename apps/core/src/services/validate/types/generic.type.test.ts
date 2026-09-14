import { describe, expect, it } from "vitest";

import { sessionIdSchema } from "./generic.type";
import { deriveTurnTraceId } from "@/services/logger/spans";

describe("sessionIdSchema", () => {
	it("accepts a session id we derived ourselves", () => {
		expect(sessionIdSchema.safeParse(deriveTurnTraceId("session-1", 0)).success).toBe(true);
	});

	it("accepts a 32-hex OTLP trace id", () => {
		// An ingested trace with no `gen_ai.conversation.id` is a session of one trace, and
		// its identifier is the sender's trace id -- 32 hex characters, no dashes, not a
		// UUID. Guarded as one, every such session 400s while its rows sit in the table.
		expect(sessionIdSchema.safeParse("4bf92f3577b34da6a3ce929d0e0e4736").success).toBe(true);
	});

	it("accepts a sender's own conversation id, whatever shape it takes", () => {
		// The GenAI conventions constrain `gen_ai.conversation.id` in no way at all. These
		// are the shapes real senders use.
		for (const id of ["conv-1", "sess_01HX3", "01ARZ3NDEKTSV4RRFFQ69G5FAV", "12345"]) {
			expect(sessionIdSchema.safeParse(id).success).toBe(true);
		}
	});

	it("refuses an empty id, an over-long one, and control characters", () => {
		// The value is always a bound query parameter and every read is scoped by org and
		// project, so this bounds the input rather than sanitising it.
		expect(sessionIdSchema.safeParse("").success).toBe(false);
		expect(sessionIdSchema.safeParse("x".repeat(201)).success).toBe(false);
		expect(sessionIdSchema.safeParse("conv\t1").success).toBe(false);
		expect(sessionIdSchema.safeParse("conv\n1").success).toBe(false);
		// A space is not a control character and is not refused: it is legal in a sender's
		// conversation id, and rejecting it would fail a real session for tidiness.
		expect(sessionIdSchema.safeParse("conv 1").success).toBe(true);
	});
});
