import { type PrismaClient, type Prompt, AiVendor, Prisma, type PromptVersion } from "@/prisma";
import { commitHash } from "../../utils/hash";
import { ModelConfigService } from "../../ai/models/modelConfigService";
import type {
	PromptCreateType,
	PromptUpdateLLMConfigType,
	PromptUpdateType,
} from "@/services/validate";
import type { StoredMessage } from "@langchain/core/messages";
import type { LanguageModelData } from "../seed/models";
import type { SystemRepository } from "./SystemRepository";
import type { ModelConfigParameters } from "@/ai/models/types";
import type { InputJsonValue } from "@prisma/client/runtime/client";
import type { PromptAuditResponse } from "@/ai/runner/types";

type DefaultLanguageModel = {
	id: number;
	name: string;
	vendor: AiVendor;
	config: ModelConfigParameters;
};

export class PromptsRepository {
	private prisma: PrismaClient;
	private systemRepository: SystemRepository;
	private modelConfigService = new ModelConfigService();

	// Кеш для дефолтной модели
	private defaultLanguageModel: DefaultLanguageModel | null = null;

	constructor(prisma: PrismaClient, systemRepository: SystemRepository) {
		this.prisma = prisma;
		this.systemRepository = systemRepository;
	}

	// get default language model from database with caching
	private async getDefaultLanguageModel(): Promise<DefaultLanguageModel> {
		// return from cache if already loaded
		if (this.defaultLanguageModel) {
			return this.defaultLanguageModel;
		}

		// search model by ID=1 (default in Prisma schema)
		// if not found, search by name and vendor as fallback
		let model = await this.prisma.languageModel.findUnique({
			where: { id: 1 },
		});

		// Fallback: search by name and vendor (in case ID changed)
		if (!model) {
			model = await this.prisma.languageModel.findFirst({
				where: {
					vendor: AiVendor.OPENAI,
					name: "gpt-4o",
					apiKeyId: null,
				},
			});
		}

		if (!model) {
			throw new Error("Default language model not found in database");
		}

		// get default config for model
		const config = this.modelConfigService.getDefaultValues(model.name, model.vendor);

		// cache the result
		this.defaultLanguageModel = {
			id: model.id,
			name: model.name,
			vendor: model.vendor,
			config,
		};

		return this.defaultLanguageModel;
	}

	/**
	 * clear default language model cache.
	 * useful for tests or when model was changed in database.
	 */
	public clearDefaultLanguageModelCache(): void {
		this.defaultLanguageModel = null;
	}

	// expose default language model config for callers that need a reset baseline
	public async getDefaultLanguageModelForReset(): Promise<{
		id: number;
		config: ModelConfigParameters;
	}> {
		const defaultModel = await this.getDefaultLanguageModel();
		return {
			id: defaultModel.id,
			config: defaultModel.config,
		};
	}

	// get project prompts
	public async getProjectPrompts(projectId: number) {
		return await this.prisma.prompt.findMany({
			where: {
				projectId,
			},
			orderBy: {
				createdAt: "desc",
			},
			select: {
				id: true,
				name: true,
				assertionType: true,
				languageModelId: true,
				createdAt: true,
				updatedAt: true,
				commited: true,
				_count: {
					select: {
						memories: true,
						testCases: true,
					},
				},
				branches: {
					select: {
						promptVersions: {
							orderBy: {
								createdAt: "desc",
							},
							select: {
								commitHash: true,
								createdAt: true,
								author: {
									select: {
										id: true,
										name: true,
										email: true,
										picture: true,
									},
								},
							},
							take: 1,
						},
					},
				},
			},
		});
	}

	// get prompt by ID
	public async getPromptById(id: number) {
		return await this.prisma.prompt.findUnique({
			where: { id },
			include: {
				branches: {
					include: {
						promptVersions: {
							orderBy: {
								createdAt: "desc",
							},
						},
					},
				},
				languageModel: true,
				audit: true,
			},
		});
	}

	public async getPromptByIdFromProject(projectId: number, id: number): Promise<Prompt | null> {
		return await this.prisma.prompt.findUnique({
			where: { id: id, projectId: projectId },
			include: {
				branches: {
					include: {
						promptVersions: {
							orderBy: {
								createdAt: "desc",
							},
						},
					},
				},
				languageModel: true,
				audit: true,
			},
		});
	}

	public async getPromptByIdSimpleFromProject(projectId: number, id: number) {
		return await this.prisma.prompt.findUnique({
			where: { id: id, projectId: projectId },
			include: {
				languageModel: true,
			},
		});
	}

	// create new prompt
	public async newProjectPrompt(
		projectId: number,
		data: PromptCreateType,
		_userId: number,
	): Promise<Prompt> {
		const defaultModel = await this.getDefaultLanguageModel();

		return await this.prisma.prompt.create({
			data: {
				name: data.name,
				value: data.value,
				languageModelConfig: defaultModel.config,
				languageModel: {
					connect: {
						id: defaultModel.id,
					},
				},
				project: {
					connect: {
						id: projectId,
					},
				},
				branches: {
					create: {
						name: "master",
					},
				},
			},
		});
	}

	// delete prompt by ID
	public async deletePromptById(id: number) {
		return await this.prisma.prompt.delete({
			where: { id },
		});
	}

	// update prompt by ID
	public async updatePromptById(id: number, data: PromptUpdateType): Promise<Prompt> {
		return await this.prisma.prompt.update({
			where: { id },
			data: data,
		});
	}

	public async updatePromptLLMConfig(id: number, data: PromptUpdateLLMConfigType) {
		return await this.prisma.prompt.update({
			where: { id },
			data: data,
		});
	}

	public async getSystemPromptByName(name: string) {
		const systemOrgId = await this.systemRepository.getSystemOrganizationId();
		if (!systemOrgId) {
			throw new Error("System organization ID not found in database");
		}

		return await this.prisma.prompt.findFirst({
			where: {
				name,
				project: {
					organizationId: systemOrgId,
				},
			},
		});
	}

	public async getModels() {
		return await this.prisma.languageModel.findMany();
	}

	public async getModelsByOrganization(orgId: number) {
		return await this.prisma.languageModel.findMany({
			where: {
				OR: [{ apiKeyId: null }, { apiKey: { organizationId: orgId } }],
			},
		});
	}

	public async getPromptsByModelId(orgId: number, modelId: number) {
		return await this.prisma.prompt.findMany({
			where: {
				languageModelId: modelId,
				project: { organizationId: orgId },
			},
		});
	}

	public async createModel(model: LanguageModelData) {
		// todo: refactor
		return await this.prisma.languageModel.create({
			data: {
				name: model.name,
				displayName: model.displayName,
				vendor: model.vendor,
				promptPrice: model.promptPrice,
				completionPrice: model.completionPrice,
				contextTokensMax: model.contextTokensMax,
				completionTokensMax: model.completionTokensMax,
				description: model.description,
			},
		});
	}

	public async updateModel(model: LanguageModelData) {
		return await this.prisma.languageModel.updateMany({
			where: {
				vendor: model.vendor,
				name: model.name,
				apiKeyId: null,
			},
			data: {
				displayName: model.displayName,
				promptPrice: model.promptPrice,
				completionPrice: model.completionPrice,
				contextTokensMax: model.contextTokensMax,
				completionTokensMax: model.completionTokensMax,
				description: model.description,
			},
		});
	}

	public async getModelConfig(name: string, vendor: AiVendor, dbParametersConfig?: unknown) {
		const modelConfigService = new ModelConfigService();

		// For custom providers, use database config if available
		if (vendor === AiVendor.CUSTOM_OPENAI_COMPATIBLE) {
			return modelConfigService.getCustomModelConfig(
				name,
				dbParametersConfig as Record<string, unknown> | null | undefined,
			);
		}

		return modelConfigService.getLLMConfig(name, vendor);
	}

	public async getBranchesByPromptID(id: number) {
		return await this.prisma.branch.findMany({
			where: { promptId: id },
			include: {
				promptVersions: {
					orderBy: {
						createdAt: "desc",
					},
					select: {
						id: true,
						commitMsg: true,
						commitHash: true,
						createdAt: true,
						author: {
							select: {
								id: true,
								name: true,
								email: true,
								picture: true,
							},
						},
					},
				},
			},
		});
	}

	public async getCommitsByBranch(promptId: number, branchName: string, authorId?: number) {
		const branch = await this.prisma.branch.findFirst({
			where: {
				promptId,
				name: branchName,
			},
		});

		if (!branch) {
			throw new Error("Branch not found");
		}

		return await this.prisma.promptVersion.findMany({
			where: {
				branchId: branch.id,
				...(authorId ? { authorId } : {}),
			},
			orderBy: {
				createdAt: "desc",
			},
			include: {
				author: {
					select: {
						id: true,
						name: true,
						email: true,
						picture: true,
					},
				},
			},
		});
	}

	public async getBranchByName(promptId: number, name: string) {
		return await this.prisma.branch.findFirst({
			where: {
				promptId,
				name,
			},
		});
	}

	public async commit(promptId: number, commitMessage: string, userId: number) {
		// to master
		const masterBranch = await this.getBranchByName(promptId, "master");
		if (!masterBranch) {
			throw new Error("branch not found");
		}

		const prompt = await this.getPromptById(promptId);
		if (!prompt) {
			throw new Error("Prompt not found");
		}

		const generations = await this.getPromptCommitCount(promptId);

		// create version
		const version = await this.prisma.promptVersion.create({
			data: {
				branch: {
					connect: {
						id: masterBranch.id,
					},
				},
				value: prompt.value,
				commitMsg: commitMessage,
				commitHash: commitHash(prompt, generations + 1), // + 1 because we are adding a new generation. to sync with current state
				languageModel: {
					connect: {
						id: prompt.languageModelId,
					},
				},
				languageModelConfig:
					prompt.languageModelConfig === null
						? Prisma.JsonNull
						: prompt.languageModelConfig,
				audit: prompt.audit?.data || undefined,
				author: {
					connect: {
						id: userId,
					},
				},
			},
		});

		return version;
	}

	public async changePromptCommitStatus(promptId: number, commited: boolean) {
		return await this.prisma.prompt.update({
			where: { id: promptId },
			data: { commited },
		});
	}

	public async getModelById(id: number) {
		return await this.prisma.languageModel.findUnique({
			where: { id },
		});
	}

	public async getLastCommitHashByPromptID(promptId: number): Promise<string | null> {
		const branch = await this.prisma.branch.findFirst({
			where: { promptId },
			include: {
				promptVersions: {
					orderBy: {
						createdAt: "desc",
					},
					take: 1,
				},
			},
		});
		return branch?.promptVersions[0]?.commitHash || null;
	}

	public async getPromptVersion(promptId: number, id: number) {
		const version = await this.prisma.promptVersion.findFirst({
			where: {
				id,
				branch: {
					promptId,
				},
			},
			include: {
				author: {
					select: {
						id: true,
						name: true,
						email: true,
						picture: true,
					},
				},
				branch: {
					select: {
						name: true,
					},
				},
				languageModel: {
					select: {
						id: true,
						name: true,
						vendor: true,
						description: true,
					},
				},
			},
		});
		return version;
	}

	public async getPromptChatByPromptId(promptId: number, userId: number) {
		return await this.prisma.promptChat.findUnique({
			where: { userId_promptId: { promptId, userId } },
		});
	}

	public async newPromptChat(promptId: number, userId: number) {
		return await this.prisma.promptChat.create({
			data: { promptId, userId },
		});
	}

	public async updatePromptChatThreadId(id: number, threadId: string) {
		return await this.prisma.promptChat.update({
			where: { id },
			data: { thread_id: threadId },
		});
	}

	public async newChatStart(promptId: number, userId: number) {
		// get promptChat
		const promptChat = await this.prisma.promptChat.findUnique({
			where: { userId_promptId: { promptId, userId } },
		});
		if (promptChat) {
			await this.prisma.promptChatMessage.deleteMany({
				where: { promptChatId: promptChat.id },
			});
		}

		return await this.prisma.promptChat.upsert({
			where: { userId_promptId: { promptId, userId } },
			update: { thread_id: null },
			create: {
				promptId,
				userId,
				thread_id: null,
			},
		});
	}

	public async saveChatMessages(chatId: number, messages: StoredMessage[]) {
		return await this.prisma.promptChatMessage.createMany({
			data: messages.map((message) => ({
				promptChatId: chatId,
				message: message as unknown as InputJsonValue,
			})),
		});
	}

	public async getChatMessages(chatId: number) {
		return await this.prisma.promptChatMessage.findMany({
			where: { promptChatId: chatId },
			orderBy: {
				id: "asc",
			},
		});
	}

	public async updatePromptAudit(promptId: number, data: PromptAuditResponse) {
		return await this.prisma.audit.upsert({
			where: { promptId },
			update: {
				data: data,
			},
			create: {
				prompt: {
					connect: {
						id: promptId,
					},
				},
				data: data,
			},
		});
	}

	public async getPromptNames(projectId: number) {
		return await this.prisma.prompt.findMany({
			where: { projectId },
			select: { id: true, name: true },
		});
	}

	public async countPromptsUsingLanguageModels(
		orgId: number,
		modelIds: number[],
	): Promise<number> {
		if (modelIds.length === 0) {
			return 0;
		}

		return await this.prisma.prompt.count({
			where: {
				languageModelId: { in: modelIds },
				project: { organizationId: orgId },
			},
		});
	}

	public async countProductiveCommitsUsingLanguageModels(
		orgId: number,
		modelIds: number[],
	): Promise<number> {
		if (modelIds.length === 0) {
			return 0;
		}

		const branches = await this.prisma.branch.findMany({
			where: {
				name: "master",
				prompt: { project: { organizationId: orgId } },
			},
			select: {
				promptVersions: {
					orderBy: { id: "desc" },
					take: 1,
					select: { languageModelId: true },
				},
			},
		});

		const modelIdSet = new Set(modelIds);
		let count = 0;
		for (const branch of branches) {
			const latest = branch.promptVersions[0];
			if (latest && modelIdSet.has(latest.languageModelId)) {
				count += 1;
			}
		}

		return count;
	}

	public async getProductiveCommit(promptId: number) {
		return await this.prisma.promptVersion.findFirst({
			where: {
				branch: {
					name: "master",
					promptId,
				},
			},
			orderBy: {
				id: "desc",
			},
		});
	}

	public async getLastCommits(promptId: number, branch: string, count: number) {
		return await this.prisma.promptVersion.findMany({
			where: {
				branch: { name: branch, promptId },
			},
			take: count,
			orderBy: {
				createdAt: "desc",
			},
		});
	}

	public async rollbackPrompt(
		promptId: number,
		version: PromptVersion,
		updateAudit: boolean = false,
	) {
		const values = {
			value: version.value,
			languageModelConfig:
				version.languageModelConfig === null
					? Prisma.JsonNull
					: version.languageModelConfig,
			languageModelId: version.languageModelId,
		};

		// update audit if needed
		if (updateAudit) {
			await this.prisma.audit.update({
				where: { promptId },
				data: {
					data: version.audit === null ? Prisma.JsonNull : version.audit,
				},
			});
		}

		return await this.prisma.prompt.update({
			where: { id: promptId },
			data: values,
		});
	}

	public async getPromptCommitCount(promptId: number, branch: string = "master") {
		return await this.prisma.promptVersion.count({
			where: {
				branch: {
					name: branch,
					promptId,
				},
			},
		});
	}

	public async countPromptsByDate(startDate: Date, endDate: Date) {
		return await this.prisma.prompt.count({
			where: {
				createdAt: {
					gte: startDate,
					lte: endDate,
				},
			},
		});
	}

	public async getLastPromptId(): Promise<number> {
		const last = await this.prisma.prompt.findFirst({
			orderBy: { id: "desc" },
			select: { id: true },
		});
		return last?.id ?? 0;
	}
}
