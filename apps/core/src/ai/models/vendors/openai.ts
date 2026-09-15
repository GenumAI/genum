import { AiVendor } from "@/prisma";
import { model } from "../builder";
import type { BuiltModel } from "../builder";

const OPENAI_RESPONSE_FORMAT = ["text", "json_object", "json_schema"] as const;
const DEFAULT_RESPONSE_FORMAT = "text" as const;

/** The GPT-5.6 family is the first OpenAI line to offer "max". */
const GPT_5_6_REASONING_EFFORT = ["none", "low", "medium", "high", "xhigh", "max"] as const;

export const OPENAI_MODELS: BuiltModel[] = [
	model("gpt-4o", AiVendor.OPENAI)
		.displayName("GPT-4o")
		.description(
			'GPT-4o ("o" for "omni") is our versatile, high-intelligence flagship model. It accepts both text and image inputs, and produces text outputs (including Structured Outputs). It is the best model for most tasks, and is our most capable model outside of our o-series models.',
		)
		.pricing({ prompt: 2.5, completion: 10, cacheRead: 1.25 })
		.limits(128_000, 16_384)
		.temperature(0, 2, 1)
		.maxTokens(1, 16_384)
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gpt-4o-mini", AiVendor.OPENAI)
		.displayName("GPT-4o mini")
		.description(
			"OpenAI's most cost-efficient small model that's smarter and cheaper than GPT-3.5 Turbo",
		)
		.pricing({ prompt: 0.15, completion: 0.6, cacheRead: 0.075 })
		.limits(128_000, 16_384)
		.temperature(0, 2, 1)
		.maxTokens(1, 16_384)
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gpt-4.1", AiVendor.OPENAI)
		.displayName("GPT-4.1")
		.description(
			"GPT-4.1 is our flagship model for complex tasks. It is well suited for problem solving across domains.",
		)
		.pricing({ prompt: 2, completion: 8, cacheRead: 0.5 })
		.limits(1_047_576, 32_768)
		.temperature(0, 2, 1)
		.maxTokens(1, 32_768)
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gpt-4.1-nano", AiVendor.OPENAI)
		.displayName("GPT-4.1 nano")
		.description("GPT-4.1 nano is the fastest, most cost-effective GPT-4.1 model.")
		.pricing({ prompt: 0.1, completion: 0.4, cacheRead: 0.025 })
		.limits(1_047_576, 32_768)
		.temperature(0, 2, 1)
		.maxTokens(1, 32_768)
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gpt-4.1-mini", AiVendor.OPENAI)
		.displayName("GPT-4.1 mini")
		.description(
			"GPT-4.1 mini provides a balance between intelligence, speed, and cost that makes it an attractive model for many use cases.",
		)
		.pricing({ prompt: 0.4, completion: 1.6, cacheRead: 0.1 })
		.limits(1_047_576, 32_768)
		.temperature(0, 2, 1)
		.maxTokens(1, 32_768)
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("o3", AiVendor.OPENAI)
		.displayName("o3")
		.description(
			"o3 is a well-rounded and powerful model across domains. It sets a new standard for math, science, coding, and visual reasoning tasks. It also excels at technical writing and instruction-following.",
		)
		.pricing({ prompt: 2, completion: 8, cacheRead: 0.5 })
		.limits(200_000, 100_000)
		.reasoningEffort(["low", "medium", "high"], "medium")
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("o3-pro", AiVendor.OPENAI)
		.displayName("o3 pro")
		.description(
			"o3 pro is a more powerful version of o3. It is optimized for complex tasks and problem solving.",
		)
		.pricing({ prompt: 20, completion: 80 })
		.limits(200_000, 100_000)
		.reasoningEffort(["low", "medium", "high"], "medium")
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("o3-mini", AiVendor.OPENAI)
		.displayName("o3 mini")
		.description(
			"o3 mini is a smaller version of o3. It is optimized for fast, effective reasoning with exceptionally efficient performance in coding and visual tasks.",
		)
		.pricing({ prompt: 1.1, completion: 4.4, cacheRead: 0.55 })
		.limits(200_000, 100_000)
		.reasoningEffort(["low", "medium", "high"], "medium")
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("o4-mini", AiVendor.OPENAI)
		.displayName("o4 mini")
		.description(
			"o4 mini is a smaller version of o4. It is optimized for fast, effective reasoning with exceptionally efficient performance in coding and visual tasks.",
		)
		.pricing({ prompt: 1.1, completion: 4.4, cacheRead: 0.275 })
		.limits(200_000, 100_000)
		.reasoningEffort(["low", "medium", "high"], "medium")
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gpt-5", AiVendor.OPENAI)
		.displayName("GPT-5")
		.description(
			"GPT-5 is a powerful model for coding and agentic tasks with configurable reasoning and non-reasoning effort.",
		)
		.pricing({ prompt: 1.25, completion: 10, cacheRead: 0.125 })
		.limits(400_000, 128_000)
		.reasoningEffort(["minimal", "low", "medium", "high"], "medium")
		.verbosity(["low", "medium", "high"], "medium")
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gpt-5-mini", AiVendor.OPENAI)
		.displayName("GPT-5 mini")
		.description(
			"GPT-5 mini is a smaller version of GPT-5. It is optimized for fast, effective reasoning with exceptionally efficient performance in coding and visual tasks.",
		)
		.pricing({ prompt: 0.25, completion: 2, cacheRead: 0.025 })
		.limits(400_000, 128_000)
		.reasoningEffort(["minimal", "low", "medium", "high"], "medium")
		.verbosity(["low", "medium", "high"], "medium")
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gpt-5-nano", AiVendor.OPENAI)
		.displayName("GPT-5 nano")
		.description(
			"GPT-5 nano is a smaller version of GPT-5. It is optimized for fast, effective reasoning with exceptionally efficient performance in coding and visual tasks.",
		)
		.pricing({ prompt: 0.05, completion: 0.4, cacheRead: 0.005 })
		.limits(400_000, 128_000)
		.reasoningEffort(["minimal", "low", "medium", "high"], "medium")
		.verbosity(["low", "medium", "high"], "medium")
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gpt-5-pro", AiVendor.OPENAI)
		.displayName("GPT-5 pro")
		.description(
			"GPT-5 pro is a more powerful version of GPT-5. It is optimized for complex tasks and problem solving.",
		)
		.pricing({ prompt: 15, completion: 120 })
		.limits(400_000, 272_000)
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gpt-5.1", AiVendor.OPENAI)
		.displayName("GPT-5.1")
		.description(
			"GPT-5.1 is our flagship model for coding and agentic tasks with configurable reasoning and non-reasoning effort.",
		)
		.pricing({ prompt: 1.25, completion: 10, cacheRead: 0.125 })
		.limits(400_000, 128_000)
		.reasoningEffort(["none", "low", "medium", "high"], "medium")
		.verbosity(["low", "medium", "high"], "medium")
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gpt-5.2", AiVendor.OPENAI)
		.displayName("GPT-5.2")
		.description("GPT-5.2 is flagship model for coding and agentic tasks across industries.")
		.pricing({ prompt: 1.75, completion: 14, cacheRead: 0.175 })
		.limits(400_000, 128_000)
		.reasoningEffort(["none", "low", "medium", "high", "xhigh"], "medium")
		.verbosity(["low", "medium", "high"], "medium")
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gpt-5.4", AiVendor.OPENAI)
		.displayName("GPT-5.4")
		.description("A more affordable model for coding and professional work.")
		.pricing({ prompt: 2.5, completion: 15, cacheRead: 0.25 })
		.limits(1_050_000, 128_000)
		.reasoningEffort(["none", "low", "medium", "high", "xhigh"], "medium")
		.verbosity(["low", "medium", "high"], "medium")
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gpt-5.4-mini", AiVendor.OPENAI)
		.displayName("GPT-5.4 mini")
		.description("Our strongest mini model yet for coding, computer use, and subagents.")
		.pricing({ prompt: 0.75, completion: 4.5, cacheRead: 0.075 })
		.limits(400_000, 128_000)
		.reasoningEffort(["none", "low", "medium", "high", "xhigh"], "medium")
		.verbosity(["low", "medium", "high"], "medium")
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gpt-5.4-nano", AiVendor.OPENAI)
		.displayName("GPT-5.4 nano")
		.description("Our cheapest GPT-5.4-class model for simple high-volume tasks.")
		.pricing({ prompt: 0.2, completion: 1.25, cacheRead: 0.02 })
		.limits(400_000, 128_000)
		.reasoningEffort(["none", "low", "medium", "high", "xhigh"], "medium")
		.verbosity(["low", "medium", "high"], "medium")
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gpt-5.5", AiVendor.OPENAI)
		.displayName("GPT-5.5")
		.description("A new class of intelligence for coding and professional work.")
		.pricing({ prompt: 5, completion: 30, cacheRead: 0.5 })
		.limits(1_050_000, 128_000)
		.reasoningEffort(["none", "low", "medium", "high", "xhigh"], "medium")
		.verbosity(["low", "medium", "high"], "medium")
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gpt-5.5-pro", AiVendor.OPENAI)
		.displayName("GPT-5.5 pro")
		.description(
			"GPT-5.5 pro uses more compute to think harder and provide consistently better answers.",
		)
		.pricing({ prompt: 30, completion: 180 })
		.limits(1_050_000, 128_000)
		.reasoningEffort(["none", "low", "medium", "high", "xhigh"], "medium")
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gpt-5.6-sol", AiVendor.OPENAI)
		.displayName("GPT-5.6 Sol")
		.description(
			"OpenAI's frontier model for complex professional work. Listed at its standard price; OpenAI is running a promotion of $4.00/$20.00 per 1M tokens through at least November 21, 2026.",
		)
		.pricing({ prompt: 5, completion: 30 })
		.limits(1_050_000, 128_000)
		.reasoningEffort(GPT_5_6_REASONING_EFFORT, "medium")
		.verbosity(["low", "medium", "high"], "medium")
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gpt-5.6-terra", AiVendor.OPENAI)
		.displayName("GPT-5.6 Terra")
		.description("Balances GPT-5.6 intelligence against cost for everyday production work.")
		.pricing({ prompt: 2, completion: 12, cacheRead: 0.2 })
		.limits(1_050_000, 128_000)
		.reasoningEffort(GPT_5_6_REASONING_EFFORT, "medium")
		.verbosity(["low", "medium", "high"], "medium")
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gpt-5.6-luna", AiVendor.OPENAI)
		.displayName("GPT-5.6 Luna")
		.description("The cheapest GPT-5.6-class model, for cost-sensitive high-volume workloads.")
		.pricing({ prompt: 0.2, completion: 1.2, cacheRead: 0.02 })
		.limits(1_050_000, 128_000)
		.reasoningEffort(GPT_5_6_REASONING_EFFORT, "medium")
		.verbosity(["low", "medium", "high"], "medium")
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),
];
