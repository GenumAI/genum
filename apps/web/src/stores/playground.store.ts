import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { promptApi } from "@/api/prompt/prompt.api";
import type { PromptResponse } from "@/api/prompt/prompt.api";
import { testcasesApi } from "@/api/testcases/testcases.api";
import { calculateTestcaseStatusCounts } from "@/lib/testcaseUtils";
import type { AuditData } from "@/types/audit";
import type { TestCase } from "@/types/TestСase";

export const defaultPromptResponse: PromptResponse = {
	answer: "",
	tokens: {
		prompt: 0,
		completion: 0,
		total: 0,
	},
	cost: {
		prompt: 0,
		completion: 0,
		total: 0,
	},
	response_time_ms: 0,
	status: "",
};

// Interface for Data
interface PlaygroundData {
	inputContent: string;
	outputContent: PromptResponse | null;
	clearedOutput: PromptResponse | null;
	expectedOutput: PromptResponse | null;

	isTestcaseLoaded: boolean;
	wasRun: boolean;
	runLoading: boolean;
	isAuditLoading: boolean;
	isUpdatingPromptContent: boolean;
	isFormattingUpdate: boolean;
	isUncommitted: boolean;
	isStatusCountsLoading: boolean;

	modalOpen: boolean;
	showAuditModal: boolean;
	diffModalInfo: { prompt: string } | null;

	status: string;
	currentExpectedThoughts: string;
	originalPromptContent: string;
	livePromptValue: string;

	currentAuditData: AuditData | null;
	isPromptChangedAfterAudit: boolean;

	hasPromptContent: boolean;
	hasInputContent: boolean;

	currentAssertionType: string;

	assertionValue: string;
	selectedMemoryId: string;
	selectedMemoryKeyName: string;
	persistedMemoryId: string;
	testcaseStatusCounts: {
		ok: number;
		nok: number;
		needRun: number;
	};
	testcases: TestCase[];
}

// Interface for Actions
interface PlaygroundActions {
	setFlags: (flags: Partial<PlaygroundData>) => void;
	setInputContent: (inputContent: string) => void;
	setOutputContent: (outputContent: PromptResponse | null) => void;
	setExpectedOutput: (expectedOutput: PromptResponse | null) => void;
	setCurrentExpectedThoughts: (thoughts: string) => void;
	setCurrentAssertionType: (type: string) => void;
	setOriginalPromptContent: (content: string) => void;
	setLivePromptValue: (value: string) => void;
	setCurrentAuditData: (data: AuditData | null) => void;
	setDiffModalInfo: (info: { prompt: string } | null) => void;
	setAssertionValue: (value: string) => void;
	setSelectedMemoryId: (id: string) => void;
	setSelectedMemoryKeyName: (name: string) => void;
	setPersistedMemoryId: (id: string) => void;
	setTestcaseStatusCounts: (counts: { ok: number; nok: number; needRun: number }) => void;
	setTestcases: (testcases: TestCase[]) => void;
	updateSingleTestcase: (testcase: TestCase) => void;
	fetchTestcases: (promptId: number | string) => Promise<void>;
	fetchAllTestcases: () => Promise<void>;

	clearOutput: () => void;
	resetForNewTestcase: () => void;
	resetOutput: () => void;
	clearAllState: () => void;
}

type PlaygroundState = PlaygroundData & PlaygroundActions;

const initialState: PlaygroundData = {
	inputContent: "",
	outputContent: null,
	clearedOutput: null,
	expectedOutput: null,

	isTestcaseLoaded: false,
	wasRun: false,
	runLoading: false,
	isAuditLoading: false,
	isUpdatingPromptContent: false,
	isFormattingUpdate: false,
	isUncommitted: false,
	isStatusCountsLoading: false,

	modalOpen: false,
	showAuditModal: false,
	diffModalInfo: null,

	status: "",
	currentExpectedThoughts: "",
	originalPromptContent: "",
	livePromptValue: "",

	currentAuditData: null,
	isPromptChangedAfterAudit: false,

	hasPromptContent: false,
	hasInputContent: false,

	currentAssertionType: "AI",

	assertionValue: "",
	selectedMemoryId: "",
	selectedMemoryKeyName: "",
	persistedMemoryId: "",
	testcaseStatusCounts: {
		ok: 0,
		nok: 0,
		needRun: 0,
	},
	testcases: [],
};

// Store creation
const usePlaygroundStore = create<PlaygroundState>()(
	devtools(
		(set, get) => ({
			...initialState,

			// Actions
			setFlags: (flags) => {
				return set((state) => ({ ...state, ...flags }), false, "setFlags");
			},

			setInputContent: (inputContent) => {
				return set(
					{ inputContent, hasInputContent: !!inputContent?.trim() },
					false,
					"setInputContent",
				);
			},
			setOutputContent: (outputContent) => {
				return set({ outputContent }, false, "setOutputContent");
			},
			setExpectedOutput: (expectedOutput) => {
				return set({ expectedOutput }, false, "setExpectedOutput");
			},
			setCurrentExpectedThoughts: (currentExpectedThoughts) => {
				return set({ currentExpectedThoughts }, false, "setCurrentExpectedThoughts");
			},
			setCurrentAssertionType: (currentAssertionType) => {
				return set({ currentAssertionType }, false, "setCurrentAssertionType");
			},
			setOriginalPromptContent: (originalPromptContent) => {
				return set(
					{
						originalPromptContent,
						livePromptValue: originalPromptContent,
						isUncommitted: true,
						hasPromptContent: !!originalPromptContent?.trim(),
					},
					false,
					"setOriginalPromptContent",
				);
			},
			setLivePromptValue: (livePromptValue) => {
				return set({ livePromptValue }, false, "setLivePromptValue");
			},
			setCurrentAuditData: (currentAuditData) => {
				return set({ currentAuditData }, false, "setCurrentAuditData");
			},
			setDiffModalInfo: (diffModalInfo) => {
				return set({ diffModalInfo }, false, "setDiffModalInfo");
			},
			setAssertionValue: (assertionValue) => {
				return set({ assertionValue }, false, "setAssertionValue");
			},
			setSelectedMemoryId: (selectedMemoryId) => {
				return set({ selectedMemoryId }, false, "setSelectedMemoryId");
			},
			setSelectedMemoryKeyName: (selectedMemoryKeyName) => {
				return set({ selectedMemoryKeyName }, false, "setSelectedMemoryKeyName");
			},
			setPersistedMemoryId: (persistedMemoryId) => {
				return set({ persistedMemoryId }, false, "setPersistedMemoryId");
			},
			setTestcaseStatusCounts: (counts) => {
				return set({ testcaseStatusCounts: counts }, false, "setTestcaseStatusCounts");
			},
			setTestcases: (testcases) => {
				return set({ testcases }, false, "setTestcases");
			},
			updateSingleTestcase: (testcase: TestCase) => {
				const { testcases } = get();
				const newTestcases = testcases.map((tc: TestCase) =>
					tc.id === testcase.id ? testcase : tc,
				);
				const counts = calculateTestcaseStatusCounts(newTestcases);
				return set(
					{ testcases: newTestcases, testcaseStatusCounts: counts },
					false,
					"updateSingleTestcase",
				);
			},
			fetchTestcases: async (promptId) => {
				if (!promptId) return;
				set({ isStatusCountsLoading: true }, false, "fetchTestcases/loading");
				try {
					const result = await promptApi.getPromptTestcases(promptId);
					if (result?.testcases) {
						const counts = calculateTestcaseStatusCounts(result.testcases);
						set(
							{
								testcaseStatusCounts: counts,
								testcases: result.testcases,
								isStatusCountsLoading: false,
							},
							false,
							"fetchTestcases/success",
						);
					}
				} catch (error) {
					console.error("Failed to fetch testcases in store", error);
					set({ isStatusCountsLoading: false }, false, "fetchTestcases/error");
				}
			},
			fetchAllTestcases: async () => {
				set({ isStatusCountsLoading: true }, false, "fetchAllTestcases/loading");
				try {
					const result = await testcasesApi.getTestcases();
					if (result?.testcases) {
						set(
							{
								testcases: result.testcases,
								isStatusCountsLoading: false,
							},
							false,
							"fetchAllTestcases/success",
						);
					}
				} catch (error) {
					console.error("Failed to fetch all testcases in store", error);
					set({ isStatusCountsLoading: false }, false, "fetchAllTestcases/error");
				}
			},

			clearOutput: () => {
				return set({ outputContent: null, clearedOutput: null }, false, "clearOutput");
			},

			resetForNewTestcase: () => {
				return set(
					{
						inputContent: "",
						currentExpectedThoughts: "",
						outputContent: null,
						clearedOutput: null,
						expectedOutput: null,
						isTestcaseLoaded: false,
						assertionValue: "",
					},
					false,
					"resetForNewTestcase",
				);
			},

			resetOutput: () => {
				return set(
					{ outputContent: null, clearedOutput: null, expectedOutput: null },
					false,
					"resetOutput",
				);
			},

			clearAllState: () => {
				return set(
					{
						...initialState,
						selectedMemoryId: "",
						selectedMemoryKeyName: "",
						persistedMemoryId: "",
						testcases: [],
					},
					false,
					"clearAllState",
				);
			},
		}),
		{ name: "playground-store", enabled: true },
	),
);

// Grouped Selectors
export const usePlaygroundUI = () =>
	usePlaygroundStore(
		useShallow((state) => ({
			modalOpen: state.modalOpen,
			showAuditModal: state.showAuditModal,
			diffModalInfo: state.diffModalInfo,
			isTestcaseLoaded: state.isTestcaseLoaded,
			wasRun: state.wasRun,
			runLoading: state.runLoading,
			isAuditLoading: state.isAuditLoading,
			isUpdatingPromptContent: state.isUpdatingPromptContent,
			status: state.status,
			isStatusCountsLoading: state.isStatusCountsLoading,
		})),
	);

export const usePlaygroundContent = () =>
	usePlaygroundStore(
		useShallow((state) => ({
			inputContent: state.inputContent,
			outputContent: state.outputContent,
			clearedOutput: state.clearedOutput,
			expectedOutput: state.expectedOutput,
			currentExpectedThoughts: state.currentExpectedThoughts,
			originalPromptContent: state.originalPromptContent,
			livePromptValue: state.livePromptValue,
			hasPromptContent: state.hasPromptContent,
			hasInputContent: state.hasInputContent,
		})),
	);

export const usePlaygroundAudit = () =>
	usePlaygroundStore(
		useShallow((state) => ({
			currentAuditData: state.currentAuditData,
			isAuditLoading: state.isAuditLoading,
			isPromptChangedAfterAudit: state.isPromptChangedAfterAudit,
		})),
	);

export const usePlaygroundTestcase = () =>
	usePlaygroundStore(
		useShallow((state) => ({
			currentAssertionType: state.currentAssertionType,
			isTestcaseLoaded: state.isTestcaseLoaded,
			assertionValue: state.assertionValue,
			selectedMemoryId: state.selectedMemoryId,
			selectedMemoryKeyName: state.selectedMemoryKeyName,
			persistedMemoryId: state.persistedMemoryId,
			testcaseStatusCounts: state.testcaseStatusCounts,
			testcases: state.testcases,
		})),
	);

export const usePlaygroundActions = () =>
	usePlaygroundStore(
		useShallow((state) => ({
			setFlags: state.setFlags,
			setInputContent: state.setInputContent,
			setOutputContent: state.setOutputContent,
			setExpectedOutput: state.setExpectedOutput,
			setCurrentExpectedThoughts: state.setCurrentExpectedThoughts,
			setCurrentAssertionType: state.setCurrentAssertionType,
			setOriginalPromptContent: state.setOriginalPromptContent,
			setLivePromptValue: state.setLivePromptValue,
			setCurrentAuditData: state.setCurrentAuditData,
			setDiffModalInfo: state.setDiffModalInfo,
			setAssertionValue: state.setAssertionValue,
			setSelectedMemoryId: state.setSelectedMemoryId,
			setSelectedMemoryKeyName: state.setSelectedMemoryKeyName,
			setPersistedMemoryId: state.setPersistedMemoryId,
			setTestcaseStatusCounts: state.setTestcaseStatusCounts,
			setTestcases: state.setTestcases,
			updateSingleTestcase: state.updateSingleTestcase,
			fetchTestcases: state.fetchTestcases,
			fetchAllTestcases: state.fetchAllTestcases,
			clearOutput: state.clearOutput,
			resetForNewTestcase: state.resetForNewTestcase,
			resetOutput: state.resetOutput,
			clearAllState: state.clearAllState,
		})),
	);

export default usePlaygroundStore;
