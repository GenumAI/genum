import type { Request, Response } from "express";
import {
	GetPromptQuerySchema,
	numberSchema,
	PromptCreateSchema,
	RunPromptSchema,
} from "@/services/validate";
import { db } from "@/database/db";
import { runPrompt } from "@/ai/runner/run";
import { SourceType } from "@/services/logger/types";
import { PromptService } from "@/services/prompt.service";

export class ApiV1Controller {
	private readonly promptService: PromptService;

	constructor() {
		this.promptService = new PromptService(db);
	}

	private async verifyRequest(req: Request) {
		const authHeader = req.headers.authorization;
		if (!authHeader) {
			throw new Error("Authorization header is missing");
		}

		const apiKey = authHeader.split(" ")[1];
		if (!apiKey) {
			throw new Error("Authorization header is missing");
		}

		const key = await db.project.getProjectApiKeyByToken(apiKey);
		if (!key) {
			throw new Error("Invalid API key");
		}

		const project = await db.project.getProjectbyApiKeyById(key.id);
		if (!project) {
			throw new Error("Project not found");
		}

		return { project, key };
	}

	async runPrompt(req: Request, res: Response) {
		const { project, key } = await this.verifyRequest(req);
		const { id, question, memoryKey, productive } = RunPromptSchema.parse(req.body);

		const organization = await db.organization.getOrganizationById(project.organizationId);
		if (!organization) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		// get prompt by id
		let prompt = await db.prompts.getPromptById(id);
		if (!prompt) {
			return res.status(404).json({ error: "Unauthorized" });
		}

		// check if prompt belongs to project
		if (prompt.projectId !== project.id) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		let memoryId: number | undefined;
		if (memoryKey) {
			const memory = await db.memories.getMemoryByKeyAndPromptId(memoryKey, prompt.id);
			if (!memory) {
				// memory not found
			} else {
				memoryId = memory.id;
			}
		}

		// update last used date
		await db.project.updateProjectApiKeyLastUsed(key.id);

		if (productive) {
			const promptWithCommit = await this.promptService.getPromptWithProductiveCommit(
				prompt,
				{
					requireCommit: true,
				},
			);
			if (!promptWithCommit) {
				return res.status(404).json({ error: "Productive commit not found." });
			}
			prompt = promptWithCommit;
		}

		const run = await runPrompt({
			prompt: prompt,
			question,
			memoryId: memoryId,
			source: SourceType.api,
			userProjectId: project.id,
			userOrgId: organization.id,
			user_id: key.authorId,
			api_key_id: key.id,
		});

		res.status(200).json({
			...run,
		});
	}

	async listPrompts(req: Request, res: Response) {
		const { project } = await this.verifyRequest(req);

		const prompts = await db.prompts.getProjectPrompts(project.id);

		res.status(200).json({ prompts });
	}

	async getPrompt(req: Request, res: Response) {
		const { project } = await this.verifyRequest(req);

		const id = numberSchema.parse(req.params.id);
		const { productive } = GetPromptQuerySchema.parse(req.query);

		let userPrompt = await db.prompts.getPromptByIdSimpleFromProject(project.id, id);
		if (!userPrompt) {
			return res.status(404).json({ error: "Prompt not found" });
		}

		if (productive) {
			const promptWithCommit =
				await this.promptService.getPromptWithProductiveCommit(userPrompt);
			if (promptWithCommit) {
				userPrompt = promptWithCommit;
			}
		}

		const { languageModel, ...prompt } = userPrompt;

		// return prompt with languageModel
		res.status(200).json({ ...prompt, languageModel });
	}

	async createPrompt(req: Request, res: Response) {
		const { project, key } = await this.verifyRequest(req);

		const data = PromptCreateSchema.parse(req.body);
		const prompt = await db.prompts.newProjectPrompt(project.id, data, key.authorId);
		res.status(200).json({ prompt });
	}
}
