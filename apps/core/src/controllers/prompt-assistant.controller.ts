import type { Request, Response } from "express";
import { db } from "@/database/db";
import type { PromptChat } from "@/prisma";
import { mdToXml } from "@/utils/xml";
import {
	AssertionEditorSchema,
	CanvasChatMessageSchema,
	InputGeneratorSchema,
	JsonSchemaEditorSchema,
	ToolEditorSchema,
	numberSchema,
} from "@/services/validate";
import { canvasAgentFormat, testcaseSummaryFormatter } from "@/ai/runner/formatter";
import { AIMessage, HumanMessage, ToolMessage } from "langchain";
import {
	mapChatMessagesToStoredMessages,
	mapStoredMessagesToChatMessages,
	type StoredMessage,
} from "@langchain/core/messages";
import { checkPromptAccess } from "@/services/access/AccessService";
import type { CanvasAgentMessage, CanvasAgentParams, CanvasMessage } from "@/ai/runner/types";
import { system_prompt } from "@/ai/runner/system";
import { runAgent } from "@/ai/runner/agent";

export class PromptAssistantController {
	public async getChatMessages(req: Request, res: Response) {
		const promptId = numberSchema.parse(req.params.id);
		const metadata = req.genumMeta.ids;

		await checkPromptAccess(promptId, metadata.projID);

		let messages: CanvasAgentMessage[] = [];

		const chat = await db.promptChats.getPromptChatByPromptId(promptId, metadata.userID);
		if (chat) {
			// messages = (await db.promptChats.getChatMessages(chat.id)).map(message => JSON.parse(message.message as string));

			const raw_chat_messages = await db.promptChats.getChatMessages(chat.id);
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
		const existingChat = await db.promptChats.getPromptChatByPromptId(
			promptId,
			metadata.userID,
		);

		// check if chat exists. create new chat if it doesn't exist
		if (!existingChat) {
			const newChat = await db.promptChats.newPromptChat(promptId, metadata.userID);
			chat = newChat;
		} else {
			chat = existingChat;
		}

		const raw_chat_messages = await db.promptChats.getChatMessages(chat.id);
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
		await db.promptChats.saveChatMessages(chat.id, stored);

		const humanMessages = chatMessagesToHuman(response);

		const agentMessagesOnly = humanMessages.filter((message) => message.role !== "user");

		res.status(200).json({ response: agentMessagesOnly });
	}

	public async newChatStart(req: Request, res: Response) {
		const promptId = numberSchema.parse(req.params.id);
		const metadata = req.genumMeta.ids;

		await checkPromptAccess(promptId, metadata.projID);

		const newChat = await db.promptChats.newChatStart(promptId, metadata.userID);

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
