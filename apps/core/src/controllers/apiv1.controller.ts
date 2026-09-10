import type { Request, Response } from "express";
import {
	GetPromptQuerySchema,
	numberSchema,
	PromptCreateSchema,
	RunPromptSchema,
} from "@/services/validate";
import { db } from "@/database/db";
import { runPrompt } from "@/ai/runner/run";
import { mergePlaceholderInput } from "@/ai/placeholders/merge-input";
import { toPlaceholderDefinitions } from "@/ai/placeholders/definitions";
import { SourceType } from "@/services/logger";
import { PromptService } from "@/services/prompt.service";
import type { FileInput } from "@/services/file.service";
import { env } from "@/env";
import { HttpError } from "@/utils/errors";
import { resolveApiKey } from "@/auth/apiKey";
import type { PlaceholderDefinition } from "@genum/placeholders";

export class ApiV1Controller {
	private readonly promptService: PromptService;
	private static readonly MAX_TOTAL_FILES_SIZE_BYTES = 50 * 1024 * 1024;
	private static readonly PROMPT_PATH_SEGMENT = "prompt";

	constructor() {
		this.promptService = new PromptService(db);
	}

	private async verifyRequest(req: Request) {
		// Moved to `@/auth/apiKey` so OTLP ingest authenticates through the same code
		// rather than a second copy of it. Status codes and messages are unchanged.
		return resolveApiKey(req.headers.authorization);
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
		const { id, question, memoryKey, placeholders, productive, files } = RunPromptSchema.parse(
			req.body,
		);
		const selection = mergePlaceholderInput({ placeholders, memoryKey });

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

		// update last used date
		await db.project.updateProjectApiKeyLastUsed(key.id);

		// Definitions come from the same object the productive commit's text came
		// from, so a productive run's text and its placeholder definitions provably
		// originate together. Left `undefined` for a non-productive run so run.ts
		// falls through and reads the live placeholder tables — an empty array here
		// would silently disable placeholder rendering instead.
		let placeholderDefinitions: PlaceholderDefinition[] | undefined;

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
			placeholderDefinitions = promptWithCommit.placeholderDefinitions;
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
			source: SourceType.api,
			userProjectId: project.id,
			userOrgId: organization.id,
			user_id: key.authorId,
			api_key_id: key.id,
			files: fileInputs,
			placeholders: selection,
			placeholderDefinitions,
		});

		res.status(200).json({
			...run,
			placeholders: {
				resolved: run.placeholders.resolved,
				ignored: run.placeholders.ignored,
			},
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

		// Names the version the returned text came from, so a caller can stamp what it ran
		// on its own records and a later replay can be told apart from it. `null` says the
		// draft is being served -- which is a fact about this response, not a missing field,
		// so it is reported rather than omitted.
		let commitHash: string | null = null;
		let placeholderDefinitions: PlaceholderDefinition[] | undefined;

		if (productive) {
			const promptWithCommit =
				await this.promptService.getPromptWithProductiveCommit(userPrompt);
			if (promptWithCommit) {
				userPrompt = promptWithCommit;
				commitHash = promptWithCommit.commitHash ?? null;
				placeholderDefinitions = promptWithCommit.placeholderDefinitions;
			}
		}

		// The draft case -- `productive=false`, or a prompt with no commit yet. The
		// definitions are then whatever the placeholder tables hold now, which is exactly
		// what a run of this prompt would render with. Omitting them made the response
		// describe a prompt whose `{{placeholders}}` the caller had no way to resolve, and
		// left it unable to tell a prompt with no placeholders from one it could not see.
		if (placeholderDefinitions === undefined) {
			placeholderDefinitions = toPlaceholderDefinitions(
				await db.placeholders.getPlaceholdersByPromptID(userPrompt.id),
			);
		}

		const { languageModel, ...prompt } = userPrompt;
		const publicUrl = this.buildPromptPublicUrl(project.organizationId, project.id, prompt.id);

		// return prompt with languageModel
		res.status(200).json({
			...prompt,
			languageModel,
			placeholderDefinitions,
			commitHash,
			publicUrl,
		});
	}

	async createPrompt(req: Request, res: Response) {
		const { project, key } = await this.verifyRequest(req);

		const { languageModelName, languageModelConfig, ...promptData } = PromptCreateSchema.parse(
			req.body,
		);

		const resolvedModel = await this.promptService.resolvePromptModelOverride(
			project.organizationId,
			{ languageModelName, languageModelConfig },
		);
		if (!resolvedModel.ok) {
			return res.status(400).json({ error: resolvedModel.error });
		}

		const prompt = await db.prompts.newProjectPrompt(
			project.id,
			promptData,
			key.authorId,
			resolvedModel.override ?? undefined,
		);

		// An uncommitted prompt has no productive version, so the API could not run
		// what it just created — commit immediately, as the seed does.
		await db.prompts.commit(prompt.id, "Initial commit", key.authorId);
		const committed = await db.prompts.changePromptCommitStatus(prompt.id, true);

		res.status(200).json({ prompt: committed });
	}
}
