import type { Project } from "@/prisma";
import type { Prompt, Organization } from "@/prisma";
import type { SourceType } from "@/services/logger/types";
import type { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "langchain";
import type OpenAI from "openai";

export type runPromptParams = {
	prompt: Prompt;
	userProjectId: number;
	userOrgId: number;
	question: string;
	memoryId?: number;
	source: SourceType;
	user_id?: number;
	testcase_id?: number;
	api_key_id?: number;
	system_instructions?: string;
	systemPrompt?: boolean;
};

export type testcaseAssertion = {
	assertionStatus: "OK" | "NOK";
	assertionThoughts: string;
};

export type CanvasAgentParams = {
	prompt: Prompt;
	question: string;
	user_id: number;
	mode: ChatMode;
	userOrgId: number;
	userProjectId: number;
	history: CanvasMessage[];
};

export type CanvasMessage = HumanMessage | SystemMessage | AIMessage | ToolMessage;

type CanvasAgentMessageRole = "user" | "agent";

type CanvasAgentMessageText = {
	role: CanvasAgentMessageRole;
	type: "text";
	message: string;
};

type CanvasAgentMessageAction = {
	role: CanvasAgentMessageRole;
	type: "action";
	message: string;
	action: {
		type: string;
		value: string | Record<string, unknown>;
	};
};

export type CanvasAgentMessage = CanvasAgentMessageText | CanvasAgentMessageAction;

export type TestcaseNamerParams = {
	user_prompt: string;
	memory_value?: string;
	input: string;
	userOrgId: number;
	userProjectId: number;
};

export type AssertionEditorParams = {
	prompt: Prompt;
	user_query: string;
	userOrgId: number;
	userProjectId: number;
};

export type JsonSchemaEditorParams = {
	json_schema: string;
	user_query: string;
	userOrgId: number;
	userProjectId: number;
};

export type ToolEditorParams = {
	tool: string;
	user_query: string;
	userOrgId: number;
	userProjectId: number;
};

export type InputGeneratorParams = {
	user_query: string;
	user_system_prompt: string;
	userOrgId: number;
	userProjectId: number;
};

export type SystemPrompt = {
	org: Organization;
	project: Project;
};

export type AgentRequest = {
	model: string;
	api_key: string;
	instruction: string;
	input: string;
	user_id: number;
	prompt_id: number;
	mode: ChatMode;
	store?: boolean;
	tools?: OpenAI.Responses.Tool[];
};

type AgentResponseMessage = {
	type: "text";
	message: string;
};

type AgentResponseAction = {
	type: "action";
	message: string;
	function: {
		name: string;
		arguments: Record<string, unknown>;
		callId: string;
	};
};

export enum ChatMode {
	AGENT = "agent",
	ASK = "ask",
}

export type AgentResponse = AgentResponseMessage | AgentResponseAction;
