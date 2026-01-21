import type { Request, Response } from "express";
import { db } from "@/database/db";
import { runPrompt } from "../ai/runner/run";
import type { AiVendor, PromptChat } from "@/prisma";
import { getPromptLogs } from "../services/logger/logger";
import { ModelConfigService } from "../ai/models/modelConfigService";
import { mdToXml, objToXml } from "@/utils/xml";
import {
	AssertionEditorSchema,
	CanvasChatMessageSchema,
	InputGeneratorSchema,
	JsonSchemaEditorSchema,
	PromptLogsQuerySchema,
	ToolEditorSchema,
} from "@/services/validate";
import {
	PromptCommitSchema,
	PromptCreateSchema,
	PromptRunSchema,
	PromptUpdateSchema,
	MemoryCreateSchema,
	MemoryUpdateSchema,
	numberSchema,
	stringSchema,
} from "@/services/validate";
import { canvasAgentFormat, testcaseSummaryFormatter } from "@/ai/runner/formatter";
import { PromptService } from "@/services/prompt.service";
import { findDiff, type PromptState } from "@/utils/diff";
import { AIMessage, HumanMessage, ToolMessage } from "langchain";
import {
	mapChatMessagesToStoredMessages,
	mapStoredMessagesToChatMessages,
	type StoredMessage,
} from "@langchain/core/messages";
import { checkMemoryAccess, checkPromptAccess } from "@/services/access/AccessService";
import type { CanvasAgentMessage, CanvasAgentParams, CanvasMessage } from "@/ai/runner/types";
import { system_prompt } from "@/ai/runner/system";
import { runAgent } from "@/ai/runner/agent";
import type { ModelConfigParameters } from "@/ai/models/types";
import { SourceType } from "@/services/logger/types";

export class PromptsController {
	private modelConfigService: ModelConfigService;
	private promptService: PromptService;

	constructor() {
		this.modelConfigService = new ModelConfigService();
		this.promptService = new PromptService(db);
	}

	public async getProjectPrompts(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const prompts = await db.prompts.getProjectPrompts(metadata.projID);

		const promptsWithStatuses = await Promise.all(
			prompts.map(async (prompt) => {
				const testcases = await db.testcases.getTestcasesByPromptId(prompt.id);
				const statusCounts = testcases.reduce(
					(acc: Record<string, number>, testcase: { status: string }) => {
						acc[testcase.status] = (acc[testcase.status] || 0) + 1;
						return acc;
					},
					{},
				);
				// const lastCommit = prompt.branches[0]?.promptVersions[0]?.commitHash || null;
				// const lastCommitAuthor = prompt.branches[0]?.promptVersions[0]?.author || null;
				const lastCommit = prompt.branches[0]?.promptVersions[0] || null;
				const { branches: _, ...promptWithoutBranches } = prompt;
				return { ...promptWithoutBranches, testcaseStatuses: statusCounts, lastCommit };
			}),
		);

		res.status(200).json({ prompts: promptsWithStatuses });
	}

	public async runPrompt(req: Request, res: Response) {
		const id = numberSchema.parse(req.params.id);
		const { question, memoryId } = PromptRunSchema.parse(req.body);

		const metadata = req.genumMeta.ids;

		const prompt = await checkPromptAccess(id, metadata.projID);

		const run = await runPrompt({
			prompt: prompt,
			question,
			memoryId: memoryId ? memoryId : undefined,
			source: SourceType.ui,
			userProjectId: metadata.projID,
			userOrgId: metadata.orgID,
			user_id: metadata.userID,
		});

		res.status(200).json({ ...run });
	}

	public async getModels(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const models = await this.promptService.getModelsForOrganization(metadata.orgID);
		res.status(200).json({ models });
	}

	public async getModelConfig(req: Request, res: Response) {
		const id = numberSchema.parse(req.params.id);
		const model = await db.prompts.getModelById(id);
		if (!model) {
			res.status(404).json({ error: `Model with id ${id} not found` });
			return;
		}

		// Pass database parametersConfig for custom models
		const config = await db.prompts.getModelConfig(
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

	public async getBranches(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const id = numberSchema.parse(req.params.id);

		await checkPromptAccess(id, metadata.projID);

		const branches = await db.prompts.getBranchesByPromptID(id);
		res.status(200).json({ branches });
	}

	public async getCommitsByBranch(req: Request, res: Response) {
		const id = numberSchema.parse(req.params.id);
		const branch = stringSchema.parse(req.params.branch);
		const metadata = req.genumMeta.ids;

		await checkPromptAccess(id, metadata.projID);

		const author = req.query.author ? numberSchema.parse(req.query.author) : undefined; // todo validation of query params

		const commits = await db.prompts.getCommitsByBranch(id, branch, author);
		res.status(200).json({ commits });
	}

	public async commitPrompt(req: Request, res: Response) {
		const id = numberSchema.parse(req.params.id);
		const metadata = req.genumMeta.ids;
		const { commitMessage } = PromptCommitSchema.parse(req.body);

		const prompt = await checkPromptAccess(id, metadata.projID);

		const version = await db.prompts.commit(id, commitMessage, metadata.userID);

		// change prompt to commited
		// await db.prompts.changePromptCommitStatus(id, true);

		await this.promptService.updateCommitedStatus(prompt);

		res.status(200).json({ version });
	}

	public async getCommit(req: Request, res: Response) {
		const id = numberSchema.parse(req.params.id);
		const commitId = numberSchema.parse(req.params.commitId);
		const metadata = req.genumMeta.ids;

		await checkPromptAccess(id, metadata.projID);

		const version = await db.prompts.getPromptVersion(id, commitId);
		if (!version) {
			res.status(404).json({ error: "Commit not found" });
			return;
		}

		res.status(200).json({ version });
	}

	public async rollbackPrompt(req: Request, res: Response) {
		const id = numberSchema.parse(req.params.id);
		const commitId = numberSchema.parse(req.params.commitId);
		const metadata = req.genumMeta.ids;

		await checkPromptAccess(id, metadata.projID);

		const version = await db.prompts.getPromptVersion(id, commitId);
		if (!version) {
			res.status(404).json({ error: "Commit not found" });
			return;
		}

		const updateAudit = version.audit !== null;

		const updatedPrompt = await db.prompts.rollbackPrompt(id, version, updateAudit);

		const rollbackVersion = await db.prompts.commit(
			id,
			`Rollback to ${version.commitHash.slice(0, 8)}`,
			metadata.userID,
		);

		await this.promptService.updateCommitedStatus(updatedPrompt);

		res.status(200).json({ rollbackVersion });
	}

	public async getPromptById(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const id = numberSchema.parse(req.params.id);

		const prompt = await checkPromptAccess(id, metadata.projID);

		const testcases = await db.testcases.getTestcasesByPromptId(id);
		const statusCounts = testcases.reduce(
			(acc: Record<string, number>, testcase: { status: string }) => {
				acc[testcase.status] = (acc[testcase.status] || 0) + 1;
				return acc;
			},
			{},
		);

		// Type assertion to handle the included relations
		const promptWithBranches = prompt as unknown as {
			branches: { promptVersions: { commitHash: string; authorId: string }[] }[];
		};
		const lastCommit = promptWithBranches.branches[0]?.promptVersions[0]?.commitHash || null;
		const lastCommitAuthor =
			promptWithBranches.branches[0]?.promptVersions[0]?.authorId || null;

		// Omit branches from the response
		const { branches: _, ...promptWithoutBranches } = promptWithBranches;
		const promptWithStatuses = {
			...promptWithoutBranches,
			testcaseStatuses: statusCounts,
			lastCommit,
			lastCommitAuthor,
		};

		res.status(200).json({ prompt: promptWithStatuses });
	}

	public async createPrompt(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const data = PromptCreateSchema.parse(req.body);

		const prompt = await db.prompts.newProjectPrompt(metadata.projID, data, metadata.userID);

		res.status(200).json({ prompt });
	}

	public async deletePrompt(req: Request, res: Response) {
		const id = numberSchema.parse(req.params.id);
		const metadata = req.genumMeta.ids;

		await checkPromptAccess(id, metadata.projID);

		await db.prompts.deletePromptById(id);
		res.status(200).json({ id });
	}

	public async updatePrompt(req: Request, res: Response) {
		const id = numberSchema.parse(req.params.id);
		const data = PromptUpdateSchema.parse(req.body);
		const metadata = req.genumMeta.ids;

		await checkPromptAccess(id, metadata.projID);

		const updatedPrompt = await db.prompts.updatePromptById(id, data);
		const updatedPromptWithStatus =
			await this.promptService.updateCommitedStatus(updatedPrompt);

		res.status(200).json({ prompt: updatedPromptWithStatus });
	}

	public async getTestcasesByPromptId(req: Request, res: Response) {
		const id = numberSchema.parse(req.params.id);
		const metadata = req.genumMeta.ids;

		await checkPromptAccess(id, metadata.projID);

		const testcases = await db.testcases.getTestcasesByPromptId(id);
		res.status(200).json({ testcases });
	}

	public async getMemoriesByPromptId(req: Request, res: Response) {
		const id = numberSchema.parse(req.params.id);
		const metadata = req.genumMeta.ids;

		await checkPromptAccess(id, metadata.projID);

		const memories = await db.memories.getMemoriesByPromptID(id);
		res.status(200).json({ memories });
	}

	public async createMemory(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);
		const data = MemoryCreateSchema.parse(req.body);

		await checkPromptAccess(promptId, metadata.projID);

		// check if memory key already exists
		const existingMemory = await db.memories.getMemoryByKeyAndPromptId(data.key, promptId);
		if (existingMemory) {
			res.status(400).json({ error: "Memory key already exists. Key must be unique." });
			return;
		}

		const memory = await db.memories.newPromptMemory(promptId, data);

		res.status(200).json({ memory });
	}

	public async getMemoryById(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);
		const memoryId = numberSchema.parse(req.params.memoryId);

		await checkPromptAccess(promptId, metadata.projID);

		await checkMemoryAccess(memoryId, promptId);

		const memory = await db.memories.getMemoryByIDAndPromptId(memoryId, promptId);
		res.status(200).json({ memory });
	}

	public async updateMemory(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);
		const memoryId = numberSchema.parse(req.params.memoryId);
		const data = MemoryUpdateSchema.parse(req.body);

		await checkPromptAccess(promptId, metadata.projID);

		await checkMemoryAccess(memoryId, promptId);

		if (data.key) {
			// if key is provided, check if memory key already exists
			const existingMemory = await db.memories.getMemoryByKeyAndPromptId(data.key, promptId);
			if (existingMemory) {
				res.status(400).json({
					error: "Memory key already exists. Key must be unique.",
				});
				return;
			}
		}

		const memory = await db.memories.updateMemoryByID(memoryId, data);

		res.status(200).json({ memory });
	}

	public async deleteMemory(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);
		const memoryId = numberSchema.parse(req.params.memoryId);

		await checkPromptAccess(promptId, metadata.projID);

		await checkMemoryAccess(memoryId, promptId);

		await db.memories.deleteMemoryByID(memoryId);
		res.status(200).json({ id: memoryId });
	}

	public async getPromptLogs(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);

		await checkPromptAccess(promptId, metadata.projID);

		const query = PromptLogsQuerySchema.parse(req.query);

		const result = await getPromptLogs(
			metadata.orgID,
			promptId,
			query.page,
			query.pageSize,
			query.fromDate,
			query.toDate,
			query.source,
			query.logLevel,
			query.query,
		);

		res.status(200).json(result);
	}

	public async saveModelConfig(req: Request, res: Response) {
		const promptId = numberSchema.parse(req.params.id);
		const metadata = req.genumMeta.ids;

		const prompt = await checkPromptAccess(promptId, metadata.projID);

		const modelId = prompt.languageModelId;
		const model = await db.prompts.getModelById(modelId);
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

		// Get the new model
		const newModel = await db.prompts.getModelById(modelId);
		if (!newModel) {
			throw new Error("Model not found");
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

	public async getChatMessages(req: Request, res: Response) {
		const promptId = numberSchema.parse(req.params.id);
		const metadata = req.genumMeta.ids;

		await checkPromptAccess(promptId, metadata.projID);

		let messages: CanvasAgentMessage[] = [];

		const chat = await db.prompts.getPromptChatByPromptId(promptId, metadata.userID);
		if (chat) {
			// messages = (await db.prompts.getChatMessages(chat.id)).map(message => JSON.parse(message.message as string));

			const raw_chat_messages = await db.prompts.getChatMessages(chat.id);
			const chat_messages = mapStoredMessagesToChatMessages(
				raw_chat_messages.map((message) => message.message as unknown as StoredMessage),
			);
			messages = chatMessagesToHuman(chat_messages as unknown as CanvasMessage[]);
		}

		res.status(200).json({ messages });
	}

	public async agent(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);
		const { query, context, mode } = CanvasChatMessageSchema.parse(req.body);

		const prompt = await checkPromptAccess(promptId, metadata.projID);

		// check if chat exists
		let chat: PromptChat;
		const existingChat = await db.prompts.getPromptChatByPromptId(promptId, metadata.userID);

		// check if chat exists. create new chat if it doesn't exist
		if (!existingChat) {
			const newChat = await db.prompts.newPromptChat(promptId, metadata.userID);
			chat = newChat;
		} else {
			chat = existingChat;
		}

		const raw_chat_messages = await db.prompts.getChatMessages(chat.id);
		const chat_messages = mapStoredMessagesToChatMessages(
			raw_chat_messages.map((message) => message.message as unknown as StoredMessage),
		);

		const promptTestcases = await db.testcases.getTestcasesByPromptId(promptId);
		const testcaseContext = testcaseSummaryFormatter(promptTestcases);

		const prompt_xml = mdToXml(prompt.value);

		const message = canvasAgentFormat({
			do_not_execute_user_draft: prompt_xml,
			do_not_execute_user_prompt_parameters: JSON.stringify(prompt.languageModelConfig),
			do_not_execute_user_prompt_context: {
				input: context?.input,
				last_output: context?.lastOutput,
				last_thoughts: context?.lastThoughts,
				expected_output: context?.expectedOutput,
				expected_thoughts: context?.expectedThoughts,
			},
			do_not_execute_user_prompt_testcase_context: testcaseContext,
			user_query: query,
		});

		const params: CanvasAgentParams = {
			prompt: prompt,
			question: message,
			mode: mode,
			user_id: metadata.userID,
			userOrgId: metadata.orgID,
			userProjectId: metadata.projID,
			history: chat_messages as unknown as CanvasMessage[],
		};
		const response = await runAgent(params);

		const stored = mapChatMessagesToStoredMessages(
			response as unknown as Parameters<typeof mapChatMessagesToStoredMessages>[0],
		);

		// // write messages to db
		await db.prompts.saveChatMessages(chat.id, stored);

		const humanMessages = chatMessagesToHuman(response);

		const agentMessagesOnly = humanMessages.filter((message) => message.role !== "user");

		res.status(200).json({ response: agentMessagesOnly });
	}

	public async newChatStart(req: Request, res: Response) {
		const promptId = numberSchema.parse(req.params.id);
		const metadata = req.genumMeta.ids;

		await checkPromptAccess(promptId, metadata.projID);

		const newChat = await db.prompts.newChatStart(promptId, metadata.userID);

		res.status(200).json({ chat: newChat });
	}

	public async auditPrompt(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);

		const prompt = await checkPromptAccess(promptId, metadata.projID);

		const audit = await system_prompt.promptAuditor(prompt.id, metadata.orgID, metadata.projID);

		// update prompt audit
		await db.prompts.updatePromptAudit(promptId, audit);

		res.status(200).json({ audit });
	}

	public async editAssertion(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);
		const { query } = AssertionEditorSchema.parse(req.body);

		const prompt = await checkPromptAccess(promptId, metadata.projID);

		const result = await system_prompt.assertionEditor({
			prompt: prompt,
			user_query: query || "",
			userOrgId: metadata.orgID,
			userProjectId: metadata.projID,
		});

		res.status(200).json({ assertion: result.answer });
	}

	public async editJsonSchema(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);
		const { query, jsonSchema } = JsonSchemaEditorSchema.parse(req.body);

		await checkPromptAccess(promptId, metadata.projID);

		const result = await system_prompt.jsonSchemaEditor({
			json_schema: jsonSchema || "",
			user_query: query,
			userOrgId: metadata.orgID,
			userProjectId: metadata.projID,
		});

		res.status(200).json({ jsonSchema: result.answer });
	}

	public async editTool(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);
		const { query, tool } = ToolEditorSchema.parse(req.body);

		await checkPromptAccess(promptId, metadata.projID);

		const result = await system_prompt.toolEditor({
			tool: tool || "",
			user_query: query,
			userOrgId: metadata.orgID,
			userProjectId: metadata.projID,
		});

		res.status(200).json({ tool: result.answer });
	}

	public async generateInput(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);
		const { query, systemPrompt } = InputGeneratorSchema.parse(req.body);

		await checkPromptAccess(promptId, metadata.projID);

		const result = await system_prompt.inputGenerator({
			user_query: query || "",
			user_system_prompt: systemPrompt,
			userOrgId: metadata.orgID,
			userProjectId: metadata.projID,
		});

		res.status(200).json({ input: result.answer });
	}

	public async getAllMemories(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const memories = await db.memories.getMemoriesFromProject(metadata.projID);
		res.status(200).json({ memories });
	}

	// public async editPrompt(req: Request, res: Response, next: NextFunction) {
	//     try {
	//         const promptId = numberSchema.parse(req.params.id);
	//         const metadata = req.genumMeta.ids;

	//         const prompt = await checkPromptAccess(promptId, metadata.projID);

	//         const { query } = PromptEditSchema.parse(req.body);

	//         const editor_query = promptEditorFormat({
	//             do_not_execute_user_draft: prompt.value,
	//             do_not_execute_user_prompt_parameters: JSON.stringify(prompt.languageModelConfig),
	//             user_query: query
	//         })

	//         const result = await this.runner.promptEditor(editor_query, metadata.orgID, metadata.projID);

	//         res.status(200).json({ prompt: result.answer, chainOfThoughts: result.chainOfThoughts });
	//     }
	//     catch (error) {
	//         next(error);
	//     }
	// }

	public async generateCommit(req: Request, res: Response) {
		const promptId = numberSchema.parse(req.params.id);
		const metadata = req.genumMeta.ids;

		let diff = "";

		const prompt = await checkPromptAccess(promptId, metadata.projID);

		const lastCommit = await db.prompts.getProductiveCommit(promptId); // todo consider that last = productive
		if (!lastCommit) {
			diff = "No last commit found. Init commit.";
		} else if (prompt.commited) {
			diff = "Prompt is commited. No changes to commit.";
		} else {
			const lastCommits = await db.prompts.getLastCommits(promptId, "master", 3);
			const lastCommitsMessage = lastCommits
				.map((commit) => {
					return `- ${commit.commitMsg}`;
				})
				.join("\n");

			const oldState: PromptState = {
				value: lastCommit.value,
				languageModelConfig: lastCommit.languageModelConfig as ModelConfigParameters,
				languageModelId: lastCommit.languageModelId,
			};

			const newState: PromptState = {
				value: prompt.value,
				languageModelConfig: prompt.languageModelConfig as ModelConfigParameters,
				languageModelId: prompt.languageModelId,
			};

			diff = await findDiff(oldState, newState, async (modelId) => {
				const model = await db.prompts.getModelById(modelId);
				if (!model) {
					throw new Error("Model not found");
				}
				return model.name;
			});

			diff = objToXml({
				last_commits: lastCommitsMessage,
				changes: diff,
			});
		}

		const result = await system_prompt.commitMessageGenerator(
			diff,
			metadata.orgID,
			metadata.projID,
		);

		res.status(200).json({ message: result.answer });
	}
}

function chatMessagesToHuman(messages: CanvasMessage[]): CanvasAgentMessage[] {
	// remove system messages
	const filtered = messages.filter(
		(message) =>
			message instanceof HumanMessage ||
			message instanceof AIMessage ||
			message instanceof ToolMessage,
	);

	const r: CanvasAgentMessage[] = filtered.map((message) => {
		if (message instanceof HumanMessage) {
			// take user query from xml tag user_query
			const userQueryMatch = message.content
				.toString()
				.match(/<user_query>([\s\S]*?)<\/user_query>/);
			const clear_user_message = userQueryMatch
				? userQueryMatch[1]
				: message.content.toString();
			return {
				role: "user",
				type: "text",
				message: clear_user_message,
			};
		} else if (message instanceof AIMessage) {
			let result = "";

			// if message has tool calls, do nothing
			if (message.tool_calls && message.tool_calls.length > 0) {
				// nothing to do
			} else {
				// if message has no tool calls, take content
				const content = message.content;
				if (typeof content === "string") {
					// if content is a string, take it
					result = content;
				} else {
					// if content is an array, take the first item
					result = content
						.map((item) => (item.type === "text" ? item.text : ""))
						.join("\n");
				}
			}

			return {
				role: "agent",
				type: "text",
				message: result,
			};
		} else if (message instanceof ToolMessage) {
			const toolName = message.name;
			if (toolName === "edit_prompt") {
				// edit_prompt
				return {
					role: "agent",
					type: "action",
					message: "Action:",
					action: {
						type: "edit_prompt",
						value: message.content.toString(),
					},
				};
			} else {
				// audit_prompt
				return {
					role: "agent",
					type: "action",
					message: "Action:",
					action: {
						type: "audit_prompt",
						value: JSON.parse(message.content as string),
					},
				};
			}
		} else {
			return {
				role: "user",
				type: "text",
				message: "Unknown message type",
			};
		}
	});

	// Фильтруем сообщения: исключаем сообщения от агента с типом "text" где message пустой
	const filteredR = r.filter((message) => {
		if (message.role === "agent" && message.type === "text") {
			return message.message && message.message.trim() !== "";
		}
		return true;
	});
	return filteredR;
}
