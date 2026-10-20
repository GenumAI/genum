import type { Request, Response } from "express";
import { db } from "@/database/db";
import type { AiVendor } from "@/prisma";
import { ModelConfigService } from "../ai/models/modelConfigService";
import { numberSchema } from "@/services/validate";
import { PromptService } from "@/services/prompt.service";
import { checkPromptAccess } from "@/services/access/AccessService";
import type { ModelConfigParameters } from "@/ai/models/types";
import { retiredModelMessage } from "@/ai/models/lifecycle";
import { ensureModelEnabledForOrg } from "./prompt.shared";

export class PromptModelsController {
	private modelConfigService: ModelConfigService;
	private promptService: PromptService;

	constructor() {
		this.modelConfigService = new ModelConfigService();
		this.promptService = new PromptService(db);
	}

	public async getModels(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const models = await this.promptService.getModelsForOrganization(metadata.orgID);
		res.status(200).json({ models });
	}

	public async getModelConfig(req: Request, res: Response) {
		const id = numberSchema.parse(req.params.id);
		const model = await db.languageModels.getModelById(id);
		if (!model) {
			res.status(404).json({ error: `Model with id ${id} not found` });
			return;
		}

		// Pass database parametersConfig for custom models
		const config = await db.languageModels.getModelConfig(
			model.name,
			model.vendor,
			model.parametersConfig, // Will be used for CUSTOM_OPENAI_COMPATIBLE
		);

		if (!config) {
			res.status(404).json({ error: `Model configuration not found` });
			return;
		}
		res.status(200).json({ config });
	}

	public async saveModelConfig(req: Request, res: Response) {
		const promptId = numberSchema.parse(req.params.id);
		const metadata = req.genumMeta.ids;

		const prompt = await checkPromptAccess(promptId, metadata.projID);

		const modelId = prompt.languageModelId;
		const model = await db.languageModels.getModelById(modelId);
		if (!model) {
			throw new Error("Model not found");
		}

		const config = req.body;

		// Validate the configuration
		const validatedConfig = this.modelConfigService.validateAndSanitizeConfig(
			model.name,
			model.vendor as AiVendor,
			config,
			model.parametersConfig as Record<string, unknown> | null | undefined,
		);

		// Update the prompt with the new configuration
		const updatedPrompt = await db.prompts.updatePromptLLMConfig(promptId, {
			languageModelConfig: validatedConfig,
		});

		const updatedPromptWithStatus =
			await this.promptService.updateCommitedStatus(updatedPrompt);

		res.status(200).json({ prompt: updatedPromptWithStatus });
	}

	public async changePromptModel(req: Request, res: Response) {
		const promptId = numberSchema.parse(req.params.id);
		const modelId = numberSchema.parse(req.params.modelId);
		const metadata = req.genumMeta.ids;

		const prompt = await checkPromptAccess(promptId, metadata.projID);

		if (!(await ensureModelEnabledForOrg(metadata.orgID, modelId, res))) {
			return;
		}

		// Get the new model
		const newModel = await db.languageModels.getModelById(modelId);
		if (!newModel) {
			throw new Error("Model not found");
		}

		const retired = retiredModelMessage(newModel);
		if (retired) {
			res.status(400).json({ error: retired });
			return;
		}

		// Get the current prompt's configuration (old configuration)
		const oldConfig = prompt.languageModelConfig as ModelConfigParameters;

		// Get default configuration for the new model
		const defaultConfigForNewModel = this.modelConfigService.getDefaultValuesForModel(
			newModel.name,
			newModel.vendor as AiVendor,
			newModel.parametersConfig as Record<string, unknown> | null | undefined,
		) as ModelConfigParameters;

		// Start with the new model's defaults
		const candidateConfig = { ...defaultConfigForNewModel };

		// Overlay values from the old configuration if the parameter exists in the new model's schema
		for (const key in oldConfig) {
			if (Object.hasOwn(oldConfig, key) && Object.hasOwn(defaultConfigForNewModel, key)) {
				const k = key as keyof ModelConfigParameters;
				(candidateConfig as Record<string, unknown>)[k] = oldConfig[k];
			}
		}

		// Special handling for json_schema - explicitly preserve it if response_format is json_schema
		if (oldConfig.response_format === "json_schema" && oldConfig.json_schema) {
			candidateConfig.response_format = "json_schema";
			candidateConfig.json_schema = oldConfig.json_schema;
		}

		// Validate and sanitize the candidate configuration against the new model.
		// This step ensures that if any carried-over oldConfig value is invalid for the newModel
		// (e.g., max_tokens too high), it's replaced by the newModel's default for that parameter.
		const finalConfig = this.modelConfigService.validateAndSanitizeConfig(
			newModel.name,
			newModel.vendor as AiVendor,
			candidateConfig,
			newModel.parametersConfig as Record<string, unknown> | null | undefined,
		);

		// Update the prompt with the new model ID and the final, validated configuration
		const updatedPrompt = await db.prompts.updatePromptLLMConfig(promptId, {
			languageModelId: modelId, // modelId is the newModel's ID
			languageModelConfig: finalConfig,
		});

		const updatedPromptWithStatus =
			await this.promptService.updateCommitedStatus(updatedPrompt);

		res.status(200).json({ prompt: updatedPromptWithStatus });
	}
}
