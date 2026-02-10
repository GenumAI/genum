import { AiVendor } from "@/prisma";
import { model } from "../builder";
import type { BuiltModel } from "../builder";

const OPENAI_RESPONSE_FORMAT = ["text", "json_object", "json_schema"] as const;
const DEFAULT_RESPONSE_FORMAT = "text" as const;

export const OPENAI_MODELS: BuiltModel[] = [
	model("gpt-4o", AiVendor.OPENAI)
		.displayName("GPT-4o")
		.description(
			'GPT-4o ("o" for "omni") is our versatile, high-intelligence flagship model. It accepts both text and image inputs, and produces text outputs (including Structured Outputs). It is the best model for most tasks, and is our most capable model outside of our o-series models.',
		)
		.pricing(2.5, 10)
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
		.pricing(0.15, 0.6)
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
		.pricing(2, 8)
		.limits(1_047_576, 32_768)
		.temperature(0, 2, 1)
		.maxTokens(1, 32_768)
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gpt-4.1-nano", AiVendor.OPENAI)
		.displayName("GPT-4.1 nano")
		.description("GPT-4.1 nano is the fastest, most cost-effective GPT-4.1 model.")
		.pricing(0.1, 0.4)
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
		.pricing(0.4, 1.6)
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
		.pricing(2, 8)
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
		.pricing(20, 80)
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
		.pricing(1.1, 4.4)
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
		.pricing(1.1, 4.4)
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
		.pricing(1.25, 10)
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
		.pricing(0.25, 2)
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
		.pricing(0.05, 0.4)
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
		.pricing(15, 120)
		.limits(400_000, 272_000)
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gpt-5.1", AiVendor.OPENAI)
		.displayName("GPT-5.1")
		.description(
			"GPT-5.1 is our flagship model for coding and agentic tasks with configurable reasoning and non-reasoning effort.",
		)
		.pricing(1.25, 10)
		.limits(400_000, 128_000)
		.reasoningEffort(["none", "low", "medium", "high"], "medium")
		.verbosity(["low", "medium", "high"], "medium")
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),

	model("gpt-5.2", AiVendor.OPENAI)
		.displayName("GPT-5.2")
		.description("GPT-5.2 is flagship model for coding and agentic tasks across industries.")
		.pricing(1.75, 14)
		.limits(400_000, 128_000)
		.reasoningEffort(["none", "low", "medium", "high", "xhigh"], "medium")
		.verbosity(["low", "medium", "high"], "medium")
		.responseFormat(OPENAI_RESPONSE_FORMAT, DEFAULT_RESPONSE_FORMAT)
		.tools()
		.build(),
];
