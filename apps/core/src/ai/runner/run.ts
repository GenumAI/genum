import { db } from "@/database/db";
import { logUsage } from "../../services/logger/logger";
import { AiVendor } from "@/prisma";
import { mdToXml } from "@/utils/xml";
import { renderPlaceholders } from "@genum/placeholders";
import { toPlaceholderDefinitions } from "../placeholders/definitions";
import {
	calculateCost,
	generateDeepSeek,
	generateGemini,
	generateOpenAI,
	type ProviderRequest,
} from "../providers";
import type { ModelConfigParameters } from "../models/types";
import { getEffectivePrices } from "../models/pricing";
import { generateAnthropic } from "../providers/anthropic/generate";
import { getApiKeyByQuota } from "@/services/access/AccessService";
import { transcribeOpenAI } from "../providers/openai/speech";
import type { runPromptParams, SystemPrompt } from "./types";
import { getSystemPrompt, SYSTEM_PROMPTS } from "./system";
import { LogLevel, LogType, SourceType } from "@/services/logger";
import { HttpError } from "@/utils/errors";

let systemPromptsConfig: SystemPrompt;

// TODO(task-6): move to services/logger once the ClickHouse column exists.
const toLogPlaceholders = (resolved: Record<string, string | null>) =>
	Object.fromEntries(Object.entries(resolved).map(([key, name]) => [key, name ?? ""]));

export async function initSystemPromptsConfig() {
	const systemOrgId = await db.system.getSystemOrganizationId();
	if (systemOrgId === null) {
		throw new Error("System organization not found");
	}

	const org = await db.organization.getOrganizationById(systemOrgId);
	if (org === null) {
		throw new Error("System organization not found");
	}
	console.log(`System organization: ${org.name} (${org.id})`);

	const systemProjectId = await db.system.getSystemProjectId();
	if (systemProjectId === null) {
		throw new Error("System project not found");
	}

	const project = await db.project.getProjectByID(systemProjectId);
	if (project === null) {
		throw new Error("System project not found");
	}
	console.log(`System project: ${project.name} (${project.id})`);

	systemPromptsConfig = {
		org,
		project,
	};

	return systemPromptsConfig;
}

export async function getSystemOrganization(_vendor: AiVendor, _userOrgId: number) {
	// todo refactor
	if (!systemPromptsConfig) {
		throw new Error(
			"System prompts config not initialized. Call initSystemPromptsConfig() first.",
		);
	}
	const config = systemPromptsConfig;

	// const quota = await db.organization.getQuotaByOrgId(userOrgId);
	// if (quota === null) {
	// 	throw new Error("Quota not found");
	// }
	// const ai_api_key = await getApiKeyByQuota(quota, userOrgId, vendor);

	// todo use userOrgId to get ai_api_key
	// const ai_api_key = await db.organization.getApiKeyByVendor(userOrgId, AiVendor.OPENAI);
	// if (ai_api_key === null) {
	// 	throw new Error("AI API key not found");
	// }

	// todo remove org api keys
	// const ai_api_key = await db.organization.getApiKeyByVendor(config.org.id, vendor);
	// if (ai_api_key === null) {
	// 	throw new Error("AI API key not found");
	// }

	return { org: config.org, project: config.project };
}

async function runPromptWithProvider(provider: AiVendor, request: ProviderRequest) {
	switch (provider) {
		case AiVendor.OPENAI:
		case AiVendor.CUSTOM_OPENAI_COMPATIBLE:
			// Both use the same OpenAI SDK, baseUrl is passed in request for custom providers
			return await generateOpenAI(request);
		case AiVendor.GOOGLE:
			return await generateGemini(request);
		case AiVendor.ANTHROPIC:
			return await generateAnthropic(request);
		case AiVendor.DEEPSEEK:
			return await generateDeepSeek(request);
		default:
			throw new Error(`Provider ${provider} not supported`);
	}
}

export async function runPrompt(data: runPromptParams) {
	const prompt = data.prompt;

	let instruction = data.system_instructions ?? prompt.value;

	// org, proj, user ids for logging. if system prompt - use system org and project
	const runOrgId = data.systemPrompt ? systemPromptsConfig.org.id : data.userOrgId;
	const runProjectId = data.systemPrompt ? systemPromptsConfig.project.id : data.userProjectId;
	const runUserId = data.systemPrompt ? undefined : data.user_id; // do not log user id for system prompts

	// get quota
	const quota = await db.organization.getQuotaByOrgId(data.userOrgId);
	if (quota === null) {
		throw new Error("Quota not found");
	}

	// get AI model
	const model = await db.prompts.getModelById(prompt.languageModelId);
	if (model === null) {
		throw new Error(`Model with id ${prompt.languageModelId} not found`);
	}

	// Enforce org-level model restrictions for non-system runs
	const isDisabled = await db.organization.isModelDisabled(runOrgId, model.id);
	if (isDisabled) {
		throw new HttpError(
			400,
			"This model is disabled for your organization. Please contact your administrator.",
		);
	}

	// For custom providers, get API key and baseUrl from the model's linked apiKey
	let apiKey: { key: string; baseUrl?: string | null };
	let quotaUsed = false;
	let baseUrl: string | undefined;

	if (model.apiKeyId) {
		// Custom provider model - get API key directly from the model's linked key
		const customApiKey = await db.organization.getApiKeyById(data.userOrgId, model.apiKeyId);
		if (!customApiKey) {
			throw new Error("Custom provider API key not found");
		}
		apiKey = { key: customApiKey.key, baseUrl: customApiKey.baseUrl };
		baseUrl = customApiKey.baseUrl || undefined;
	} else {
		// Standard provider - get API key based on quota
		const result = await getApiKeyByQuota(quota, data.userOrgId, model.vendor);
		apiKey = result.apiKey;
		quotaUsed = result.quotaUsed;
	}

	// Placeholders. Definitions come from the same object the text came from: for a
	// productive run that is the commit snapshot (see getPromptWithProductiveCommit),
	// otherwise the live tables. Reading them from different places is exactly the
	// drift this feature exists to remove.
	const definitions = data.placeholderDefinitions
		? data.placeholderDefinitions
		: toPlaceholderDefinitions(await db.placeholders.getPlaceholdersByPromptID(prompt.id));

	const render = renderPlaceholders(instruction, definitions, data.placeholders ?? {});
	instruction = render.text;

	try {
		// run prompt
		const completion = await runPromptWithProvider(model.vendor, {
			apikey: apiKey.key,
			instruction: data.systemPrompt
				? `<system_prompt>${mdToXml(instruction)}</system_prompt>`
				: mdToXml(instruction),
			question: data.question,
			model: model.name,
			parameters: prompt.languageModelConfig as ModelConfigParameters,
			files: data.files,
			promptPrice: model.promptPrice,
			completionPrice: model.completionPrice,
			baseUrl, // Pass baseUrl for custom providers
		});

		const cost = calculateCost(
			{
				prompt: completion.tokens.prompt,
				completion: completion.tokens.completion,
			},
			// Most models bill at the price stored on the model; some (DeepSeek) vary it by
			// time of day, so resolve the effective price at the moment the run is billed.
			getEffectivePrices(model.vendor, model.name, model.promptPrice, model.completionPrice),
		);

		if (quotaUsed) {
			await db.organization.chargeQuota(data.userOrgId, cost.total);
		}

		await logUsage({
			source: data.source,
			log_type: LogType.PromptRunSuccess,
			log_lvl: LogLevel.success,
			orgId: runOrgId,
			project_id: runProjectId,
			prompt_id: prompt.id,
			user_id: runUserId,
			vendor: model.vendor,
			model: model.name,
			tokens_in: completion.tokens.prompt,
			tokens_out: completion.tokens.completion,
			tokens_sum: completion.tokens.total,
			cost: cost.total,
			response_ms: completion.response_time_ms,
			in: data.question,
			out: completion.answer,
			placeholders: toLogPlaceholders(render.resolved),
			testcase_id: data.testcase_id ? data.testcase_id : undefined,
			api_key_id: data.api_key_id ? data.api_key_id : undefined,
		});

		return {
			...completion,
			cost,
			placeholders: {
				resolved: render.resolved,
				ignored: render.ignored,
				undefinedKeys: render.undefinedKeys,
			},
		};
	} catch (error) {
		console.error(error);

		await logUsage({
			source: data.source,
			log_type: LogType.AIError,
			log_lvl: LogLevel.error,
			orgId: runOrgId,
			project_id: runProjectId,
			prompt_id: prompt.id,
			vendor: model.vendor,
			model: model.name,
			tokens_in: 0,
			tokens_out: 0,
			tokens_sum: 0,
			cost: 0,
			response_ms: 0,
			in: data.question,
			out: "",
			placeholders: toLogPlaceholders(render.resolved),
			description: error instanceof Error ? error.message : "Error occurred",
			user_id: runUserId,
			testcase_id: data.testcase_id ? data.testcase_id : undefined,
			api_key_id: data.api_key_id ? data.api_key_id : undefined,
		});

		throw error;
	}
}

export async function transcribe(
	audio: string | Buffer,
	user_id: number,
	userOrgId: number,
	_userProjectId: number,
	user_email: string,
): Promise<string> {
	const { prompt: speech_to_text, system_org } = await getSystemPrompt(
		SYSTEM_PROMPTS.SPEECH_TO_TEXT,
		userOrgId,
	);

	const quota = await db.organization.getQuotaByOrgId(userOrgId);
	if (quota === null) {
		throw new Error("Quota not found");
	}

	const { apiKey } = await getApiKeyByQuota(quota, userOrgId, AiVendor.OPENAI); // OpenAI is hardcoded for now. whisper-1 stt model is used

	const transcription = await transcribeOpenAI(apiKey.key, audio); // todo: refactor

	await logUsage({
		source: SourceType.api,
		log_type: LogType.PromptRunSuccess,
		log_lvl: LogLevel.success,
		orgId: system_org.org.id,
		project_id: system_org.project.id,
		prompt_id: speech_to_text.id,
		user_id: undefined, // do not log user id for speech to text
		vendor: "OPENAI",
		model: "whisper-1",
		tokens_in: 0,
		tokens_out: 0,
		tokens_sum: 0,
		cost: 0,
		response_ms: 0,
		in: `**binary audio** from user ${user_email}(${user_id})`,
		out: transcription,
	});

	return transcription;
}
