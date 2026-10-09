import { type PrismaClient, type Prompt, Prisma, type PromptVersion } from "@/prisma";
import { commitHash } from "../../utils/hash";
import type {
	PromptCreateType,
	PromptUpdateLLMConfigType,
	PromptUpdateType,
} from "@/services/validate";
import type { SystemRepository } from "./SystemRepository";
import type { LanguageModelsRepository, NewPromptModelOverride } from "./LanguageModelsRepository";
import type { PromptAuditResponse } from "@/ai/runner/types";
import {
	parsePlaceholderSnapshot,
	placeholderFingerprint,
	toPlaceholderDefinitions,
} from "@/ai/placeholders/definitions";

export class PromptsRepository {
	private prisma: PrismaClient;
	private systemRepository: SystemRepository;
	// owns the default-model cache; injected so the whole app shares one copy
	private languageModels: LanguageModelsRepository;

	constructor(
		prisma: PrismaClient,
		systemRepository: SystemRepository,
		languageModels: LanguageModelsRepository,
	) {
		this.prisma = prisma;
		this.systemRepository = systemRepository;
		this.languageModels = languageModels;
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
	//
	// Scalars only. This is what `checkPromptAccess` reads on nearly every prompt route
	// just to compare `projectId`, and what the prompt auditor and the public API's run
	// endpoint read for `value` / `languageModelConfig`. The relations it used to carry
	// are unbounded: `branches -> promptVersions` grows by one full prompt body plus its
	// audit and placeholder JSON on every commit, so a prompt with two hundred commits
	// used to cost two hundred prompt bodies per request, forever. Callers that actually
	// render the history ask for it by name below.
	public async getPromptById(id: number): Promise<Prompt | null> {
		return await this.prisma.prompt.findUnique({
			where: { id },
		});
	}

	// The whole prompt page in one row: the model it runs on, its audit, and the newest
	// version of each branch first. Only PromptsController.getPromptById needs this.
	public async getPromptByIdWithHistory(id: number) {
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

	public async getPromptByIdSimpleFromProject(projectId: number, id: number) {
		return await this.prisma.prompt.findUnique({
			where: { id: id, projectId: projectId },
			include: {
				languageModel: true,
			},
		});
	}

	// create new prompt
	// `override` lets a caller (e.g. the public API's languageModelName /
	// languageModelConfig extension) pin the model + config explicitly; when
	// omitted this is byte-for-byte the historical default-model behavior.
	public async newProjectPrompt(
		projectId: number,
		data: PromptCreateType,
		_userId: number,
		override?: NewPromptModelOverride,
	): Promise<Prompt> {
		const { languageModelId, languageModelConfig } =
			override ?? (await this.languageModels.getDefaultModelOverride());

		return await this.prisma.prompt.create({
			data: {
				name: data.name,
				value: data.value,
				// Omitted leaves the column's own default (XML), which is what every prompt
				// that existed before this field has.
				...(data.instructionFormat ? { instructionFormat: data.instructionFormat } : {}),
				languageModelConfig,
				languageModel: {
					connect: {
						id: languageModelId,
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
				// Nested, so the prompt and its placeholders are one write. The caller
				// commits immediately after this returns, and `commit()` snapshots the LIVE
				// placeholder tables -- so a prompt that reached the commit without its
				// placeholders would be committed with an empty snapshot, and every
				// `productive=true` read of it would report a prompt with no definitions
				// while its text is full of holes. Creating them afterwards cannot fix that
				// without a second commit.
				...(data.placeholders && data.placeholders.length > 0
					? {
							placeholders: {
								create: data.placeholders.map((placeholder) => ({
									key: placeholder.key,
									description: placeholder.description ?? null,
									values: {
										create: placeholder.values.map((value) => ({
											name: value.name,
											content: value.content,
											isDefault: value.isDefault ?? false,
										})),
									},
								})),
							},
						}
					: {}),
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

	public async getPromptsByModelId(orgId: number, modelId: number) {
		return await this.prisma.prompt.findMany({
			where: {
				languageModelId: modelId,
				project: { organizationId: orgId },
			},
		});
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
						// The commits page has to show what logic each commit carries, not
						// just its text -- a placeholder edit changes what the model
						// receives, so a commit that does not show its definitions is
						// hiding half of what was committed. `null` on commits made before
						// placeholders existed, which the UI renders as "not recorded"
						// rather than as "none".
						placeholders: true,
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

	public async commit(
		promptId: number,
		commitMessage: string,
		userId: number,
		// Rollback's escape hatch: it must reproduce an old commit's own placeholder
		// snapshot, not re-snapshot the live tables commit() would otherwise take.
		// undefined (the normal path) means "snapshot the live tables"; an explicit
		// null means "this old version had no snapshot" and is stored as JSON null,
		// not dropped -- the same convention `languageModelConfig` already uses below.
		placeholderSnapshot?: Prisma.JsonValue,
	) {
		// to master
		const masterBranch = await this.getBranchByName(promptId, "master");
		if (!masterBranch) {
			throw new Error("branch not found");
		}

		// Scalars plus the audit this version copies. The branch is already resolved above
		// and nothing here reads the version history, so it is not fetched.
		const prompt = await this.prisma.prompt.findUnique({
			where: { id: promptId },
			include: { audit: true },
		});
		if (!prompt) {
			throw new Error("Prompt not found");
		}

		const generations = await this.getPromptCommitCount(promptId);

		const definitions =
			placeholderSnapshot !== undefined
				? parsePlaceholderSnapshot(placeholderSnapshot)
				: toPlaceholderDefinitions(
						await this.prisma.placeholder.findMany({
							where: { promptId },
							include: { values: { orderBy: { id: "asc" } } },
							orderBy: { id: "asc" },
						}),
					);

		// Stored verbatim on the rollback path so an explicit null stays JSON null
		// rather than becoming an empty array -- `definitions` is the parsed reading of
		// the same thing, used for the hash.
		const placeholders = placeholderSnapshot !== undefined ? placeholderSnapshot : definitions;

		// The hash must cover what THIS commit stores, not today's live tables. On the
		// rollback path the two differ, and hashing the live tables would leave the new
		// commit looking current while it serves an older snapshot -- exactly the
		// text/definition drift the snapshot exists to remove.
		const fingerprint = placeholderFingerprint(definitions);

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
				// + 1 because we are adding a new generation. to sync with current state
				commitHash: commitHash(prompt, generations + 1, fingerprint),
				languageModel: {
					connect: {
						id: prompt.languageModelId,
					},
				},
				languageModelConfig:
					prompt.languageModelConfig === null
						? Prisma.JsonNull
						: prompt.languageModelConfig,
				placeholders:
					placeholders === null
						? Prisma.JsonNull
						: (placeholders as unknown as Prisma.InputJsonValue),
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

	public async getPromptsUsingLanguageModels(
		orgId: number,
		modelIds: number[],
	): Promise<{ id: number; name: string }[]> {
		if (modelIds.length === 0) {
			return [];
		}

		return await this.prisma.prompt.findMany({
			where: {
				languageModelId: { in: modelIds },
				project: { organizationId: orgId },
			},
			select: { id: true, name: true },
			orderBy: { name: "asc" },
		});
	}

	public async getProductiveCommitPromptsUsingLanguageModels(
		orgId: number,
		modelIds: number[],
	): Promise<{ id: number; name: string }[]> {
		if (modelIds.length === 0) {
			return [];
		}

		const branches = await this.prisma.branch.findMany({
			where: {
				name: "master",
				prompt: { project: { organizationId: orgId } },
			},
			select: {
				prompt: { select: { id: true, name: true } },
				promptVersions: {
					orderBy: { id: "desc" },
					take: 1,
					select: { languageModelId: true },
				},
			},
		});

		const modelIdSet = new Set(modelIds);
		const prompts: { id: number; name: string }[] = [];
		for (const branch of branches) {
			const latest = branch.promptVersions[0];
			if (latest && modelIdSet.has(latest.languageModelId)) {
				prompts.push(branch.prompt);
			}
		}

		return prompts.sort((a, b) => a.name.localeCompare(b.name));
	}

	public async getProductiveCommit(promptId: number) {
		return await this.prisma.promptVersion.findFirst({
			where: {
				branch: {
					name: "master",
					promptId,
				},
			},
			// The commit pins `languageModelId`, so the model it was committed with is a
			// property of the commit, not of the prompt row. Without this include, a caller
			// serving the committed text alongside the prompt's LIVE `languageModel` reports
			// a text and a model that were never used together -- the prompt's model can be
			// changed in the editor long after the commit was cut.
			include: {
				languageModel: true,
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

		// One transaction: a crash between the two writes used to leave the prompt
		// rolled back while the audit still held the newer data.
		return await this.prisma.$transaction(async (tx) => {
			if (updateAudit) {
				await tx.audit.update({
					where: { promptId },
					data: {
						data: version.audit === null ? Prisma.JsonNull : version.audit,
					},
				});
			}

			return await tx.prompt.update({
				where: { id: promptId },
				data: values,
			});
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
