export const DEFAULT_CHAT_OPTIONS = [
	{
		text: "Optimize prompt",
		description: "I can help you improve your prompt for better results",
	},
	{
		text: "Fix prompt",
		description: "Let me help you troubleshoot and fix your prompt",
	},
	{
		text: "Audit prompt",
		description: "Audit the prompt for potential issues and improve it",
	},
];

export const ACTION_MESSAGES = {
	edit_prompt: {
		title: "Prompt edited",
		description: "Please review the updated prompt and accept it.",
	},
	audit_prompt: {
		title: "Prompt audited",
		description: "Please review the audit suggestions.",
	},
} as const;

export const CHAT_MODES = {
	AGENT: "agent",
	ASK: "ask",
} as const;
