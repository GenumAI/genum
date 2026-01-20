import type { PromptResponse } from "@/api/prompt/prompt.api";
import type { Options } from "@/hooks/usePrompt";
import type { PromptSettings, TLanguageModel } from "@/types/Prompt";
import type { TestCase } from "@/types/TestСase";
import type { AuditData } from "@/types/audit";

// ============================================================================
// Grouped Data Types for Playground Controller
// ============================================================================

export type UpdatePromptContentOptions = {
	isEmpty?: boolean;
	isFormattingOnly?: boolean;
} & Options;

/**
 * Prompt-related data group
 */
export interface PlaygroundPromptGroup {
	/** Full prompt data from API */
	data: { prompt: PromptSettings } | null;
	/** Loading state for prompt data */
	loading: boolean;
	/** Error message if prompt update failed */
	error: string | null;
	/** Current system prompt content (live or original) */
	content: string;
	/** Original prompt content from server */
	originalContent: string;
}

/**
 * Testcase-related data group
 */
export interface PlaygroundTestcaseGroup {
	/** Current testcase data */
	data: TestCase | null;
	/** Testcase ID from URL params */
	id: string | null;
	/** Formatted expected content from testcase */
	expectedContent: PromptResponse | null;
	/** Loading state for resolving the selected testcase (e.g. while fetching testcase list) */
	loading: boolean;
}

/**
 * Metrics data group (tokens, cost, response time)
 */
export interface PlaygroundMetricsGroup {
	/** Token usage statistics */
	tokens: {
		prompt: number;
		completion: number;
		total: number;
	};
	/** Cost statistics */
	cost: {
		prompt: number;
		completion: number;
		total: number;
	};
	/** Response time in milliseconds */
	responseTime: number | null;
}

/**
 * UI state group (modals, loading states, validation)
 */
export interface PlaygroundUIGroup {
	/** Modal states */
	modals: {
		/** Assertion modal state */
		assertion: {
			open: boolean;
			status: string;
		};
		/** Audit modal state */
		audit: {
			open: boolean;
			data: AuditData | null;
			rate?: number;
		};
		/** Diff modal state */
		diff: {
			prompt: string;
		} | null;
	};
	/** Loading states for various operations */
	loading: {
		prompt: boolean;
		run: boolean;
		audit: boolean;
		fixing: boolean;
		statusCounts: boolean;
		updatingContent: boolean;
	};
	/** Validation states */
	validation: {
		hasPromptContent: boolean;
		hasInputContent: boolean;
	};
}

/**
 * Actions group (all handler functions)
 */
export interface PlaygroundActionsGroup {
	/** Prompt-related actions */
	prompt: {
		/** Update prompt content */
		update: (value: string, options?: UpdatePromptContentOptions) => Promise<void>;
		/** Handle prompt update with toast notifications */
		handleUpdate: (newPrompt: string) => Promise<void>;
	};
	/** Testcase-related actions */
	testcase: {
		/** Save current output as expected */
		saveAsExpected: (content: { answer: string; thoughts?: string }) => Promise<void>;
		/** Handle testcase added event */
		onAdded: () => Promise<void>;
		/** Handle input blur event (save input) */
		onInputBlur: () => Promise<void>;
		/** Register clear function for expected output */
		registerClearFn: (clearFn: () => void) => void;
	};
	/** Run prompt/testcase action */
	run: () => Promise<void>;
	/** Audit-related actions */
	audit: {
		/** Run audit on prompt */
		run: () => Promise<void>;
		/** Open audit modal */
		openModal: () => void;
		/** Close audit modal */
		closeModal: () => void;
		/** Run audit (same as run but different name) */
		runAudit: () => Promise<void>;
		/** Fix audit risks */
		fix: (recommendations: string[]) => Promise<void>;
		/** Save diff from audit fixes */
		saveDiff: (value: string) => void;
	};
	/** UI-related actions */
	ui: {
		/** Close assertion modal */
		closeAssertionModal: () => void;
		/** Set diff modal state */
		setDiffModal: (info: { prompt: string } | null) => void;
	};
}

/**
 * Complete return type for usePlaygroundController
 */
export interface PlaygroundControllerReturn {
	prompt: PlaygroundPromptGroup;
	testcase: PlaygroundTestcaseGroup;
	metrics: PlaygroundMetricsGroup;
	ui: PlaygroundUIGroup;
	models: TLanguageModel[];
	actions: PlaygroundActionsGroup;
}

// ============================================================================
// Store Action Types
// ============================================================================

/**
 * Run state for batch updates
 */
export interface RunState {
	loading: boolean;
	wasRun?: boolean;
	clearedOutput?: PromptResponse | null;
}

/**
 * Testcase load state for batch updates
 */
export interface TestcaseLoadState {
	loaded: boolean;
	status?: string;
}
