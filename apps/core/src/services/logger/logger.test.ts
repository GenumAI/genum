import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prompt } from "@/prisma";

const clickhouse = vi.hoisted(() => ({ insert: vi.fn(), query: vi.fn() }));

vi.mock("@clickhouse/client", () => ({
	createClient: () => clickhouse,
}));

vi.mock("@/env", () => ({
	env: {
		NODE_ENV: "test",
		CLICKHOUSE_URL: "http://localhost:8123",
		CLICKHOUSE_DB: "genum",
		CLICKHOUSE_USER: "default",
		CLICKHOUSE_PASSWORD: "",
	},
}));

vi.mock("@/services/sentry/init", () => ({
	captureSentryException: vi.fn(),
	captureSentryMessage: vi.fn(),
}));

vi.mock("@/database/db", () => ({
	db: {
		organization: {
			getQuotaByOrgId: vi.fn(),
			isModelDisabled: vi.fn(),
			getApiKeyById: vi.fn(),
			chargeQuota: vi.fn(),
		},
		prompts: {
			getModelById: vi.fn(),
		},
		placeholders: {
			getPlaceholdersByPromptID: vi.fn(),
		},
	},
}));

vi.mock("@/services/access/AccessService", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/services/access/AccessService")>()),
	getApiKeyByQuota: vi.fn(),
}));

vi.mock("@/ai/providers", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/ai/providers")>()),
	generateOpenAI: vi.fn(),
}));

import { db } from "@/database/db";
import { generateOpenAI } from "@/ai/providers";
import { runPrompt } from "@/ai/runner/run";
import { getApiKeyByQuota } from "@/services/access/AccessService";
import { captureSentryException } from "@/services/sentry/init";
import { logUsage } from "./logger";
import { LogLevel, LogType, SourceType, type LogDocument } from "./types";

type Mock = ReturnType<typeof vi.fn>;

const DOCUMENT: LogDocument = {
	source: SourceType.api,
	log_lvl: LogLevel.success,
	log_type: LogType.PromptRunSuccess,
	orgId: 1,
	project_id: 2,
	prompt_id: 3,
	vendor: "OPENAI",
	model: "gpt-4o",
	tokens_in: 10,
	tokens_out: 20,
	tokens_sum: 30,
	cost: 0.0004,
	response_ms: 640,
	in: "how much is 2+2?",
	out: "4",
};

const MODEL = {
	id: 5,
	name: "gpt-4o",
	vendor: "OPENAI",
	promptPrice: 2.5,
	completionPrice: 10,
	apiKeyId: null,
};

const COMPLETION = {
	answer: "4",
	tokens: { prompt: 10, completion: 20, total: 30 },
	response_time_ms: 640,
};

const PROMPT = {
	id: 3,
	value: "You are a calculator.",
	languageModelId: 5,
	languageModelConfig: {},
} as unknown as Prompt;

function runParams() {
	return {
		prompt: PROMPT,
		userOrgId: 1,
		userProjectId: 2,
		question: "how much is 2+2?",
		source: SourceType.api,
		placeholderDefinitions: [],
	};
}

describe("logUsage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(console, "error").mockImplementation(() => {});
		clickhouse.insert.mockResolvedValue(undefined);
	});

	it("writes the row to the logs table", async () => {
		await logUsage(DOCUMENT);

		expect(clickhouse.insert).toHaveBeenCalledTimes(1);
		expect(clickhouse.insert.mock.calls[0][0]).toMatchObject({
			table: "logs",
			values: [{ orgId: 1, project_id: 2, prompt_id: 3, out: "4" }],
		});
	});

	it("resolves when the insert fails, instead of failing the run it describes", async () => {
		// The run this row describes is already finished and already charged: rethrowing
		// here handed the caller a 500 for an answer they had paid for.
		clickhouse.insert.mockRejectedValue(new Error("connect ECONNREFUSED"));

		await expect(logUsage(DOCUMENT)).resolves.toBeUndefined();
	});

	it("reports the dropped row rather than swallowing it silently", async () => {
		clickhouse.insert.mockRejectedValue(new Error("connect ECONNREFUSED"));

		await logUsage(DOCUMENT);

		expect(console.error).toHaveBeenCalled();
		expect(captureSentryException).toHaveBeenCalledTimes(1);
	});
});

describe("runPrompt analytics", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(console, "error").mockImplementation(() => {});
		clickhouse.insert.mockResolvedValue(undefined);
		(db.organization.getQuotaByOrgId as Mock).mockResolvedValue({ id: 1 });
		(db.organization.isModelDisabled as Mock).mockResolvedValue(false);
		(db.organization.chargeQuota as Mock).mockResolvedValue(undefined);
		(db.prompts.getModelById as Mock).mockResolvedValue(MODEL);
		(getApiKeyByQuota as Mock).mockResolvedValue({
			apiKey: { key: "sk-test" },
			quotaUsed: true,
		});
		(generateOpenAI as Mock).mockResolvedValue(COMPLETION);
	});

	it("returns the completion even when the ClickHouse write fails", async () => {
		clickhouse.insert.mockRejectedValue(new Error("connect ECONNREFUSED"));

		const result = await runPrompt(runParams());

		expect(result.answer).toBe("4");
		expect(db.organization.chargeQuota).toHaveBeenCalledTimes(1);
		await vi.waitFor(() => expect(captureSentryException).toHaveBeenCalledTimes(1));
	});

	it("does not wait for the write to settle before returning", async () => {
		let settle: () => void = () => {};
		clickhouse.insert.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					settle = resolve;
				}),
		);

		const result = await runPrompt(runParams());

		expect(result.answer).toBe("4");
		expect(clickhouse.insert).toHaveBeenCalledTimes(1);
		settle();
	});

	it("surfaces the provider's error, not ClickHouse's, when the run itself fails", async () => {
		(generateOpenAI as Mock).mockRejectedValue(new Error("provider is down"));
		clickhouse.insert.mockRejectedValue(new Error("connect ECONNREFUSED"));

		await expect(runPrompt(runParams())).rejects.toThrow("provider is down");
	});
});
