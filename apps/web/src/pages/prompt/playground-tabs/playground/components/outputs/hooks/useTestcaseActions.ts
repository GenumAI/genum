import { useCallback, useState } from "react";
import { testcasesApi } from "@/api/testcases/testcases.api";
import { promptApi } from "@/api/prompt/prompt.api";
import type { TestcasePayload } from "@/hooks/useCreateTestcase";
import { useToast } from "@/hooks/useToast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePlaceholderSelection } from "@/pages/prompt/playground-tabs/playground/hooks/usePlaceholderSelection";
import { testcaseKeys } from "@/query-keys/testcases.keys";
import type { Step } from "@/types/steps";

/** Stable identity: a fresh `[]` here would re-fire the picker dialog's reset effect forever. */
const NO_STEPS: Step[] = [];

interface UseTestcaseActionsProps {
	promptId: number | undefined;
	onTestcaseAdded?: () => void;
	selectedFiles?: Array<{ id: string }>;
	/**
	 * The in-memory trajectory being authored in the playground, if any. Used, not a
	 * round trip through ClickHouse, because it is what the author just watched -- see
	 * `TestcaseStepPickerDialog`'s callers for the same reasoning.
	 */
	trajectorySteps?: Step[];
}

/** Captured at "Add testcase" click time, so a later run cannot move what the picker saves. */
interface PendingCreate {
	input: string;
	expectedOutput: string;
	lastOutput: string;
	steps: Step[];
}

export const useTestcaseActions = ({
	promptId,
	onTestcaseAdded,
	selectedFiles,
	trajectorySteps,
}: UseTestcaseActionsProps) => {
	const { toast } = useToast();
	// The same reading the run uses. Posting the raw store here is what reported a key
	// as "could not transfer" that the run had already dropped without a word -- the
	// selection was dead either way, and only one of the two surfaces said so.
	const { selection: placeholderSelection } = usePlaceholderSelection(promptId);
	const queryClient = useQueryClient();
	const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(null);

	const createTestcaseMutation = useMutation({
		mutationKey: testcaseKeys.create(promptId),
		mutationFn: async (payload: TestcasePayload) => {
			return testcasesApi.createTestcase(payload);
		},
		onSuccess: async () => {
			if (!promptId) return;
			try {
				await queryClient.fetchQuery({
					queryKey: testcaseKeys.promptTestcases(promptId),
					queryFn: async () => {
						const response = await promptApi.getPromptTestcases(promptId);
						return response.testcases || [];
					},
				});
			} catch (error) {
				console.error("Failed to refresh prompt testcases after create:", error);
			}
			onTestcaseAdded?.();
		},
	});

	const performCreate = useCallback(
		async (
			input: string,
			expectedOutput: string,
			lastOutput: string,
			expectedSteps?: Step[],
		) => {
			if (!promptId) {
				toast({
					title: "Failed to add test case",
					description: "Prompt ID is missing.",
					variant: "destructive",
				});
				return { success: false };
			}

			const createPayload: TestcasePayload = {
				promptId: Number(promptId),
				input: input || "",
				expectedOutput: expectedOutput,
				lastOutput: lastOutput || "",
				placeholders: placeholderSelection,
				files:
					selectedFiles && selectedFiles.length > 0
						? selectedFiles.map((f) => f.id)
						: undefined,
				// Left unset for a plain text testcase: the backend rejects an empty array,
				// and a testcase that pins no steps is a text testcase by definition.
				...(expectedSteps && expectedSteps.length > 0
					? { expectedSteps, stepsConfig: { orderMatters: false } }
					: {}),
			};

			let success = false;
			let unresolvedPlaceholders: string[] = [];

			try {
				const response = await createTestcaseMutation.mutateAsync(createPayload);
				unresolvedPlaceholders = response.unresolvedPlaceholders ?? [];
				success = true;
			} catch (err) {
				console.error("Create testcase error:", err);
				success = false;
			} finally {
				if (success && unresolvedPlaceholders.length > 0) {
					// A value that has since been renamed or deleted cannot transfer --
					// saying so here is the difference between a partial transfer and a
					// silent one. Matches useAddTestcaseFromLog's wording for the same case.
					toast({
						title: "Test case added",
						description: `Your test case was saved, but these placeholders could not transfer: ${unresolvedPlaceholders.join(", ")}.`,
						variant: "default",
					});
				} else {
					toast({
						title: success ? "Test case added" : "Failed to add test case",
						description: success
							? "Your test case was saved successfully."
							: "Unknown error, try again.",
						variant: success ? "default" : "destructive",
					});
				}
			}

			return { success };
		},
		[promptId, placeholderSelection, selectedFiles, toast, createTestcaseMutation],
	);

	const createTestcase = useCallback(
		async (
			input: string,
			expectedOutput: string,
			lastOutput: string,
			// `"deferred"` is not a failure -- opening the picker is success for this call;
			// `performCreate` has not run yet and will not until the author confirms steps.
			// A plain `{ success: false }` here would tell the next caller the same thing a
			// genuine failure does, which is exactly the lie this shape exists to avoid.
		): Promise<{ status: "created" | "deferred" | "failed" }> => {
			// A trajectory is in hand: a run full of tool calls (or a reply mid-session)
			// must not silently become a plain text testcase -- ask which steps to pin
			// rather than dropping them. A session with no tool calls and one turn has an
			// empty trajectory and keeps today's behaviour: no picker.
			if (Array.isArray(trajectorySteps) && trajectorySteps.length > 0) {
				setPendingCreate({ input, expectedOutput, lastOutput, steps: trajectorySteps });
				return { status: "deferred" };
			}

			const { success } = await performCreate(input, expectedOutput, lastOutput);
			return { status: success ? "created" : "failed" };
		},
		[trajectorySteps, performCreate],
	);

	const confirmSteps = useCallback(
		async (steps: Step[]) => {
			if (!pendingCreate) return;
			const result = await performCreate(
				pendingCreate.input,
				pendingCreate.expectedOutput,
				pendingCreate.lastOutput,
				steps,
			);
			if (result.success) setPendingCreate(null);
		},
		[pendingCreate, performCreate],
	);

	return {
		isTestcaseLoading: createTestcaseMutation.isPending,
		createTestcase,
		/** Props for `TestcaseStepPickerDialog`; the picker is open when a create is pending. */
		stepPicker: {
			open: pendingCreate !== null,
			trajectory: pendingCreate?.steps ?? NO_STEPS,
			saving: createTestcaseMutation.isPending,
			onCancel: () => setPendingCreate(null),
			onConfirm: confirmSteps,
		},
	};
};
