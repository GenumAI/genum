import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ConversationMessage } from "@/ai/providers";

vi.mock("@/env", () => ({
	env: { FRONTEND_URL: "https://lab.genum.ai", INSTANCE_TYPE: "local" },
}));

vi.mock("@/database/db", () => ({
	db: {
		organization: {
			getQuotaByOrgId: vi.fn(),
			isModelDisabled: vi.fn(),
			getApiKeyById: vi.fn(),
			chargeQuota: vi.fn(),
		},
		prompts: { getModelById: vi.fn() },
		placeholders: { getPlaceholdersByPromptID: vi.fn() },
	},
}));

vi.mock("@/services/access/AccessService", () => ({ getApiKeyByQuota: vi.fn() }));

// Resolves, because the caller no longer awaits it: `recordUsage` fires the write off the
// critical path and attaches a `.catch`, so a mock returning `undefined` would blow up
// inside the runner rather than exercising it.
vi.mock("@/services/logger/logger", () => ({ logUsage: vi.fn(async () => {}) }));

vi.mock("@/ai/providers", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/ai/providers")>()),
	generateOpenAI: vi.fn(),
	generateGemini: vi.fn(),
	generateDeepSeek: vi.fn(),
}));

import { db } from "@/database/db";
import { getApiKeyByQuota } from "@/services/access/AccessService";
import { logUsage } from "@/services/logger/logger";
import { generateOpenAI } from "@/ai/providers";
import { callPromptModel, runPrompt } from "./run";
import type { runPromptParams } from "./types";
import { SourceType } from "@/services/logger";

const PROMPT = {
	id: 7,
	value: "do this",
	languageModelId: 3,
	languageModelConfig: {},
} as unknown as runPromptParams["prompt"];

function params(): runPromptParams {
	return {
		prompt: PROMPT,
		question: "what is the weather",
		source: SourceType.testcase,
		userOrgId: 1,
		userProjectId: 2,
		user_id: 4,
	};
}

function completion(overrides: Record<string, unknown> = {}) {
	return {
		answer: "the answer",
		tokens: { prompt: 10, completion: 5, total: 15 },
		response_time_ms: 12,
		...overrides,
	};
}

describe("runPrompt / callPromptModel share one resolution", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(db.organization.getQuotaByOrgId).mockResolvedValue({ id: 1 } as never);
		vi.mocked(db.organization.isModelDisabled).mockResolvedValue(false as never);
		vi.mocked(db.prompts.getModelById).mockResolvedValue({
			id: 3,
			name: "gpt-4o",
			vendor: "OPENAI",
			promptPrice: 1,
			completionPrice: 2,
			apiKeyId: null,
		} as never);
		vi.mocked(db.placeholders.getPlaceholdersByPromptID).mockResolvedValue([] as never);
		vi.mocked(getApiKeyByQuota).mockResolvedValue({
			apiKey: { key: "sk-test" },
			quotaUsed: true,
		} as never);
		vi.mocked(generateOpenAI).mockResolvedValue(completion() as never);
	});

	it("sends no `messages` for a plain run, exactly as before", async () => {
		const run = await runPrompt(params());

		expect(run.answer).toBe("the answer");
		expect(vi.mocked(generateOpenAI).mock.calls[0][0].messages).toBeUndefined();
		// The behaviour a plain run has always had: quota charged, usage logged once.
		expect(db.organization.chargeQuota).toHaveBeenCalledTimes(1);
		expect(logUsage).toHaveBeenCalledTimes(1);
	});

	it("passes the conversation through and resolves the run the same way", async () => {
		const messages: ConversationMessage[] = [
			{ role: "assistant", content: "", toolCalls: [{ id: "c1", name: "t", args: {} }] },
			{ role: "tool", toolCallId: "c1", name: "t", content: "42" },
		];

		await callPromptModel(params(), messages);

		const request = vi.mocked(generateOpenAI).mock.calls[0][0];
		expect(request.messages).toEqual(messages);
		// Same model, same key, same rendered instruction as the plain run above --
		// a replayed turn that resolved differently would silently invalidate the test
		// it is supposed to be asserting.
		expect(db.prompts.getModelById).toHaveBeenCalledWith(PROMPT.languageModelId);
		expect(request.apikey).toBe("sk-test");
		expect(request.model).toBe("gpt-4o");
		expect(request.instruction).toContain("do this");
	});

	it("charges quota and logs a replayed turn like any other run", async () => {
		await callPromptModel(params(), []);

		expect(db.organization.chargeQuota).toHaveBeenCalledTimes(1);
		expect(logUsage).toHaveBeenCalledTimes(1);
	});

	it("returns the tool calls the model asked for", async () => {
		const toolCalls = [{ id: "c1", name: "get_weather", args: { city: "Berlin" } }];
		vi.mocked(generateOpenAI).mockResolvedValue(completion({ toolCalls }) as never);

		const turn = await callPromptModel(params(), []);

		expect(turn.toolCalls).toEqual(toolCalls);
	});

	it("hands the usage document over instead of logging it, but still charges quota", async () => {
		const collected: unknown[] = [];

		await callPromptModel({ ...params(), collectUsage: (doc) => collected.push(doc) }, []);

		// The caller writes one root row for the whole run; N turns must not become N
		// rows. The turn is still a real provider call, so quota is still charged.
		expect(logUsage).not.toHaveBeenCalled();
		expect(db.organization.chargeQuota).toHaveBeenCalledTimes(1);
		expect(collected).toEqual([
			expect.objectContaining({
				vendor: "OPENAI",
				model: "gpt-4o",
				tokens_in: 10,
				tokens_out: 5,
				tokens_sum: 15,
				out: "the answer",
			}),
		]);
	});

	it("still logs a failed turn even when usage is collected", async () => {
		// The exception propagates and the collector never gets to write anything, so
		// suppressing this row too would lose the failure entirely.
		vi.mocked(generateOpenAI).mockRejectedValue(new Error("provider down"));
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

		await expect(
			callPromptModel({ ...params(), collectUsage: () => {} }, []),
		).rejects.toThrow("provider down");

		consoleError.mockRestore();
		expect(logUsage).toHaveBeenCalledTimes(1);
		expect(vi.mocked(logUsage).mock.calls[0][0].log_type).toBe("ae");
	});

	it("still logs the error and rethrows when the provider fails", async () => {
		vi.mocked(generateOpenAI).mockRejectedValue(new Error("provider down"));
		// runPrompt console.errors the failure; keep the suite's output clean.
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

		await expect(runPrompt(params())).rejects.toThrow("provider down");

		consoleError.mockRestore();
		expect(logUsage).toHaveBeenCalledTimes(1);
		expect(vi.mocked(logUsage).mock.calls[0][0].description).toBe("provider down");
		expect(db.organization.chargeQuota).not.toHaveBeenCalled();
	});
});
