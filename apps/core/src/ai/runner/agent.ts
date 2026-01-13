import { db } from "@/database/db";
import { promptEditorFormat } from "./formatter";
import { mdToXml, objToXml } from "@/utils/xml";
import { z } from "zod";
import { createAgent, HumanMessage, SystemMessage, tool } from "langchain";
import { getApiKeyByQuota } from "@/services/access/AccessService";
import { type AgentRequest, type CanvasAgentParams, type CanvasMessage, ChatMode } from "./types";
import { getSystemPrompt, system_prompt, SYSTEM_PROMPTS } from "./system";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatAnthropic } from "@langchain/anthropic";
import { AiVendor } from "@/prisma";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

const contextSchema = z.object({
	userOrgId: z.number(),
	userProjectId: z.number(),
	prompt: z.object({
		id: z.number(),
		value: z.string(),
		languageModelConfig: z.string(),
	}),
});

const editPromptToolV2 = tool(
	async (
		// biome-ignore lint/correctness/noUnusedFunctionParameters: we need to pass the description to the tool
		{ edit, description }: { edit: string; description: string },
		config: LangGraphRunnableConfig,
	) => {
		// edit some prompt
		const context = config.context as z.infer<typeof contextSchema>;

		const edittedPrompt = (
			await system_prompt.promptEditor(
				promptEditorFormat({
					do_not_execute_user_draft: context.prompt.value,
					do_not_execute_user_prompt_parameters: context.prompt.languageModelConfig,
					user_query: edit,
				}),
				context.userOrgId,
				context.userProjectId,
			)
		).answer;

		return `${edittedPrompt}`;
	},
	{
		name: "edit_prompt",
		description:
			"Use this tool to propose an edit to an existing user prompt instruction.This will be read by a less intelligent model, which will quickly apply the edit. You should make it clear what the edit is, while also minimizing the unchanged intruction you write.Make sure it is clear what the edit should be.",
		schema: z.object({
			edit: z
				.string()
				.describe(
					"Specify ONLY the precise lines of instruction that you wish to edit. **NEVER specify or write out unchanged instruction**. Instead, represent all unchanged instruction using the comment.",
				),
			description: z
				.string()
				.describe(
					"A single sentence instruction describing what you are going to do for the sketched edit. This is used to assist the less intelligent model in applying the edit. Please use the first person to describe what you are going to do. Dont repeat what you have said previously in normal messages. And use it to disambiguate uncertainty in the edit.",
				),
		}),
	},
);

const auditPromptToolV2 = tool(
	// biome-ignore lint/correctness/noUnusedFunctionParameters: we need to pass the description to the tool
	async ({ description }: { description: string }, config: LangGraphRunnableConfig) => {
		const context = config.context as z.infer<typeof contextSchema>;

		const audit = await system_prompt.promptAuditor(
			context.prompt.id,
			context.userOrgId,
			context.userProjectId,
		);
		return audit;
	},
	{
		name: "audit_prompt",
		description:
			"Use this tool to propose an audit to a prompt instruction.Audit will analyze the prompt instruction and provide a list of potential issues and suggestions for improvement.",
		schema: z.object({
			description: z
				.string()
				.describe(
					"A single sentence instruction describing what you are going to do for the audit.",
				),
		}),
	},
);

export async function runAgent(params: CanvasAgentParams): Promise<CanvasMessage[]> {
	try {
		const {
			prompt: canvas_agent,
			system_org,
			model,
		} = await getSystemPrompt(SYSTEM_PROMPTS.CANVAS_AGENT, params.userOrgId);

		const quota = await db.organization.getQuotaByOrgId(params.userOrgId);
		if (quota === null) {
			throw new Error("Quota not found");
		}

		const { apiKey } = await getApiKeyByQuota(quota, params.userOrgId, model.vendor);

		const agentRequest: AgentRequest = {
			model: model.name,
			api_key: apiKey.key,
			instruction: mdToXml(canvas_agent.value),
			input: params.question,
			user_id: params.user_id,
			prompt_id: system_org.project.id,
			mode: params.mode,
			store: false,
			tools: [],
		};

		const canvas_model = initAgentModel(model.vendor, model.name, apiKey.key);
		canvas_model.temperature = 0;

		const messages: CanvasMessage[] = [];
		const new_messages: CanvasMessage[] = [];

		if (params.history.length > 0) {
			// add history to messages array
			messages.push(...params.history);
			// add new human message to the new_messages array
			new_messages.push(new HumanMessage(agentRequest.input));
		} else {
			// if no history, add system message and human message to the messages array
			new_messages.push(
				new SystemMessage(agentRequest.instruction),
				new HumanMessage(agentRequest.input),
			);
		}

		const agent = createAgent({
			model: canvas_model,
			contextSchema: contextSchema, // context schema for the agent. incl prompt, userOrgId, userProjectId
			tools: params.mode === ChatMode.ASK ? [] : [editPromptToolV2, auditPromptToolV2], // if mode is ask, don't use tools
		});

		// save messages count before invoke to determine new messages
		// agent returns all messages, including passed and new messages, so we need to know the total number
		const messagesCountBeforeInvoke = messages.length;

		// merge old messages and input messages array
		const messagesToInvoke = [...messages, ...new_messages];

		const result = await agent.invoke(
			{
				messages: messagesToInvoke,
			},
			{
				recursionLimit: 4,
				context: {
					userOrgId: params.userOrgId,
					userProjectId: params.userProjectId,
					prompt: {
						id: params.prompt.id,
						value: params.prompt.value,
						languageModelConfig: objToXml(
							params.prompt.languageModelConfig as Record<string, unknown>,
						),
					},
				},
			},
		);

		console.log("result", result);

		// detect new messages from agent
		// result.messages includes all messages, including history and new messages
		const allMessagesAfterInvoke = result.messages as CanvasMessage[];
		const newMessagesFromAgent = allMessagesAfterInvoke.slice(messagesCountBeforeInvoke);

		return newMessagesFromAgent;
	} catch (error) {
		console.error(error);
		throw error;
	}
}

function initAgentModel(provider: AiVendor, model: string, apiKey: string) {
	switch (provider) {
		case AiVendor.OPENAI:
			return new ChatOpenAI({
				apiKey: apiKey,
				model: model,
			});
		case AiVendor.GOOGLE:
			return new ChatGoogleGenerativeAI({
				apiKey: apiKey,
				model: model,
			});
		case AiVendor.ANTHROPIC:
			return new ChatAnthropic({
				apiKey: apiKey,
				model: model,
			});
		default:
			throw new Error(`Provider ${provider} not supported`);
	}
}
