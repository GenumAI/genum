import type { Request, Response } from "express";
import {
	GetPromptQuerySchema,
	numberSchema,
	PromptCreateSchema,
	RunPromptSchema,
} from "@/services/validate";
import { db } from "@/database/db";
import { runPrompt } from "@/ai/runner/run";
import { SourceType } from "@/services/logger";
import { PromptService } from "@/services/prompt.service";
import type { FileInput } from "@/services/file.service";
import { extractBearerToken } from "@/utils/http";
import { env } from "@/env";

export class ApiV1Controller {
	private readonly promptService: PromptService;
	private static readonly MAX_TOTAL_FILES_SIZE_BYTES = 50 * 1024 * 1024;
	private static readonly PROMPT_PATH_SEGMENT = "prompt";

	constructor() {
		this.promptService = new PromptService(db);
	}

	private async verifyRequest(req: Request) {
		const apiKey = extractBearerToken(req.headers.authorization);
		if (!apiKey) {
			throw new Error("Invalid or missing Authorization header. Expected: Bearer <token>");
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

	private parseApiFiles(files: { fileName: string; contentType: string; base64: string }[]) {
		const parsedFiles: FileInput[] = [];
		let totalBytes = 0;

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			const normalizedBase64 = this.normalizeBase64(file.base64);
			const buffer = Buffer.from(normalizedBase64, "base64");

			if (!this.isValidBase64(normalizedBase64, buffer)) {
				throw new Error(`Invalid base64 payload for file "${file.fileName}"`);
			}

			totalBytes += buffer.length;
			if (totalBytes > ApiV1Controller.MAX_TOTAL_FILES_SIZE_BYTES) {
				throw new Error("Total files size exceeds 50MB limit");
			}

			parsedFiles.push({
				id: `external-${i}`,
				fileName: file.fileName,
				contentType: file.contentType,
				buffer,
			});
		}

		return parsedFiles;
	}

	private normalizeBase64(value: string) {
		const withoutDataUrl = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
		return withoutDataUrl.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
	}

	private isValidBase64(value: string, decoded: Buffer) {
		if (value.length === 0) {
			return false;
		}

		const normalizedInput = value.replace(/=+$/g, "");
		const normalizedDecoded = decoded.toString("base64").replace(/=+$/g, "");

		return normalizedInput === normalizedDecoded;
	}

	private buildPromptPublicUrl(orgId: number, projectId: number, promptId: number): string {
		const frontendUrl = env.FRONTEND_URL.replace(/\/+$/g, "");
		return `${frontendUrl}/${orgId}/${projectId}/${ApiV1Controller.PROMPT_PATH_SEGMENT}/${promptId}`;
	}

	async runPrompt(req: Request, res: Response) {
		const { project, key } = await this.verifyRequest(req);
		const { id, question, memoryKey, productive, files } = RunPromptSchema.parse(req.body);

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

		let fileInputs: FileInput[] = [];
		try {
			fileInputs = this.parseApiFiles(files);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Invalid files payload";
			return res.status(400).json({ error: message });
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
			files: fileInputs,
		});

		res.status(200).json({
			...run,
		});
	}

	async listPrompts(req: Request, res: Response) {
		const { project } = await this.verifyRequest(req);

		const prompts = await db.prompts.getProjectPrompts(project.id);
		const promptsWithPublicUrl = prompts.map((prompt) => ({
			...prompt,
			publicUrl: this.buildPromptPublicUrl(project.organizationId, project.id, prompt.id),
		}));

		res.status(200).json({ prompts: promptsWithPublicUrl });
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
		const publicUrl = this.buildPromptPublicUrl(project.organizationId, project.id, prompt.id);

		// return prompt with languageModel
		res.status(200).json({ ...prompt, languageModel, publicUrl });
	}

	async createPrompt(req: Request, res: Response) {
		const { project, key } = await this.verifyRequest(req);

		const data = PromptCreateSchema.parse(req.body);
		const prompt = await db.prompts.newProjectPrompt(project.id, data, key.authorId);
		res.status(200).json({ prompt });
	}
}
