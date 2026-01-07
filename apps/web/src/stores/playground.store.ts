import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { promptApi } from "@/api/prompt/prompt.api";
import type { PromptResponse } from "@/api/prompt/prompt.api";
import { testcasesApi } from "@/api/testcases/testcases.api";
import { calculateTestcaseStatusCounts } from "@/lib/testcaseUtils";
import type { AuditData } from "@/types/audit";
import type { TestCase } from "@/types/TestСase";
import type { RunState, TestcaseLoadState } from "@/pages/prompt/playground-tabs/playground-layout/types";

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
	isFixing: boolean;
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

	commitMessage: string;

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
	// Content setters
	setInputContent: (inputContent: string) => void;
	setOutputContent: (outputContent: PromptResponse | null) => void;
	setExpectedOutput: (expectedOutput: PromptResponse | null) => void;
	setCurrentExpectedThoughts: (thoughts: string) => void;
	setCurrentAssertionType: (type: string) => void;
	setOriginalPromptContent: (content: string) => void;
	setLivePromptValue: (value: string) => void;
	setCurrentAuditData: (data: AuditData | null) => void;
	setAssertionValue: (value: string) => void;
	setCommitMessage: (message: string) => void;
	setSelectedMemoryId: (id: string) => void;
	setSelectedMemoryKeyName: (name: string) => void;
	setPersistedMemoryId: (id: string) => void;
	setTestcaseStatusCounts: (counts: { ok: number; nok: number; needRun: number }) => void;
	setTestcases: (testcases: TestCase[]) => void;
	updateSingleTestcase: (testcase: TestCase) => void;
	fetchTestcases: (promptId: number | string) => Promise<void>;
	fetchAllTestcases: () => Promise<void>;

	// UI Modal actions
	openAssertionModal: () => void;
	closeAssertionModal: () => void;
	openAuditModal: () => void;
	closeAuditModal: () => void;
	setDiffModal: (info: { prompt: string } | null) => void;

	// Loading state actions
	setRunLoading: (loading: boolean) => void;
	setAuditLoading: (loading: boolean) => void;
	setFixingState: (fixing: boolean) => void;
	setUpdatingPromptContent: (updating: boolean) => void;
	setStatusCountsLoading: (loading: boolean) => void;

	// Batch update actions
	setRunState: (state: RunState) => void;
	setTestcaseLoadState: (state: TestcaseLoadState) => void;

	// Other state setters
	setStatus: (status: string) => void;
	setIsPromptChangedAfterAudit: (changed: boolean) => void;
	setClearedOutput: (output: PromptResponse | null) => void;

	// Reset actions
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
	isFixing: false,
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

	commitMessage: "",

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

		// Content setters
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
		setAssertionValue: (assertionValue) => {
				return set({ assertionValue }, false, "setAssertionValue");
			},
			setCommitMessage: (commitMessage) => {
				return set({ commitMessage }, false, "setCommitMessage");
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

			// UI Modal actions
			openAssertionModal: () => {
				return set({ modalOpen: true }, false, "openAssertionModal");
			},
			closeAssertionModal: () => {
				return set({ modalOpen: false }, false, "closeAssertionModal");
			},
			openAuditModal: () => {
				return set({ showAuditModal: true }, false, "openAuditModal");
			},
			closeAuditModal: () => {
				return set({ showAuditModal: false }, false, "closeAuditModal");
			},
		setDiffModal: (diffModalInfo: { prompt: string } | null) => {
			return set({ diffModalInfo }, false, "setDiffModal");
		},

			// Loading state actions
			setRunLoading: (runLoading) => {
				return set({ runLoading }, false, "setRunLoading");
			},
			setAuditLoading: (isAuditLoading) => {
				return set({ isAuditLoading }, false, "setAuditLoading");
			},
			setFixingState: (isFixing) => {
				return set({ isFixing }, false, "setFixingState");
			},
			setUpdatingPromptContent: (isUpdatingPromptContent) => {
				return set({ isUpdatingPromptContent }, false, "setUpdatingPromptContent");
			},
			setStatusCountsLoading: (isStatusCountsLoading) => {
				return set({ isStatusCountsLoading }, false, "setStatusCountsLoading");
			},

			// Batch update actions
			setRunState: (state) => {
				return set(
					{
						runLoading: state.loading,
						...(state.wasRun !== undefined && { wasRun: state.wasRun }),
						...(state.clearedOutput !== undefined && { clearedOutput: state.clearedOutput }),
					},
					false,
					"setRunState",
				);
			},
			setTestcaseLoadState: (state) => {
				return set(
					{
						isTestcaseLoaded: state.loaded,
						...(state.status !== undefined && { status: state.status }),
					},
					false,
					"setTestcaseLoadState",
				);
			},

			// Other state setters
			setStatus: (status) => {
				return set({ status }, false, "setStatus");
			},
			setIsPromptChangedAfterAudit: (isPromptChangedAfterAudit) => {
				return set({ isPromptChangedAfterAudit }, false, "setIsPromptChangedAfterAudit");
			},
			setClearedOutput: (clearedOutput) => {
				return set({ clearedOutput }, false, "setClearedOutput");
			},

			// Reset actions
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
						commitMessage: "",
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
						commitMessage: "",
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
			isFixing: state.isFixing,
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
			// Content setters
			setInputContent: state.setInputContent,
			setOutputContent: state.setOutputContent,
			setExpectedOutput: state.setExpectedOutput,
			setCurrentExpectedThoughts: state.setCurrentExpectedThoughts,
			setCurrentAssertionType: state.setCurrentAssertionType,
			setOriginalPromptContent: state.setOriginalPromptContent,
			setLivePromptValue: state.setLivePromptValue,
			setCurrentAuditData: state.setCurrentAuditData,
			setAssertionValue: state.setAssertionValue,
			setSelectedMemoryId: state.setSelectedMemoryId,
			setSelectedMemoryKeyName: state.setSelectedMemoryKeyName,
			setPersistedMemoryId: state.setPersistedMemoryId,
			setTestcaseStatusCounts: state.setTestcaseStatusCounts,
			setTestcases: state.setTestcases,
			updateSingleTestcase: state.updateSingleTestcase,
			fetchTestcases: state.fetchTestcases,
			fetchAllTestcases: state.fetchAllTestcases,

			// UI Modal actions
			openAssertionModal: state.openAssertionModal,
			closeAssertionModal: state.closeAssertionModal,
			openAuditModal: state.openAuditModal,
			closeAuditModal: state.closeAuditModal,
			setDiffModal: state.setDiffModal,

			// Loading state actions
			setRunLoading: state.setRunLoading,
			setAuditLoading: state.setAuditLoading,
			setFixingState: state.setFixingState,
			setUpdatingPromptContent: state.setUpdatingPromptContent,
			setStatusCountsLoading: state.setStatusCountsLoading,

			// Batch update actions
			setRunState: state.setRunState,
			setTestcaseLoadState: state.setTestcaseLoadState,

			// Other state setters
			setStatus: state.setStatus,
			setIsPromptChangedAfterAudit: state.setIsPromptChangedAfterAudit,
			setClearedOutput: state.setClearedOutput,

			// Reset actions
			clearOutput: state.clearOutput,
			resetForNewTestcase: state.resetForNewTestcase,
			resetOutput: state.resetOutput,
			clearAllState: state.clearAllState,
		})),
	);

export default usePlaygroundStore;
