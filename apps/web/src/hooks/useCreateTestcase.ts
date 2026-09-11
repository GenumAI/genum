import { testcasesApi } from "@/api/testcases/testcases.api";
import { useMutation } from "@tanstack/react-query";

import type { Step, StepsConfig } from "@/types/steps";

export interface TestcasePayload {
	promptId: number;
	input: string;
	expectedOutput: string;
	lastOutput?: string;
	name?: string;
	files?: string[];
	placeholders?: Record<string, string>;
	/**
	 * The trajectory steps this testcase pins, copied out of a recorded trace. The
	 * backend rejects an empty array (`StepsSchema.min(1)`) on purpose -- a trajectory
	 * testcase that pins nothing can never fail -- so leave the field unset for a plain
	 * text testcase rather than sending `[]`.
	 */
	expectedSteps?: Step[];
	stepsConfig?: StepsConfig;
	/** See `CreateTestcaseData.offeredTools`: unset means the recording never said. */
	offeredTools?: string[];
	pinnedSelectionDrift?: boolean;
}

export interface CreateTestcaseResult {
	ok: boolean;
	unresolvedPlaceholders: string[];
}

export function useCreateTestcase() {
	const createTestcaseMutation = useMutation({
		mutationFn: async (payload: TestcasePayload) => {
			return await testcasesApi.createTestcase(payload);
		},
	});

	const createTestcase = async (payload: TestcasePayload): Promise<CreateTestcaseResult> => {
		try {
			const response = await createTestcaseMutation.mutateAsync(payload);
			return { ok: true, unresolvedPlaceholders: response.unresolvedPlaceholders ?? [] };
		} catch (err: any) {
			console.error("Create testcase error:", err);
			return { ok: false, unresolvedPlaceholders: [] };
		}
	};

	return {
		createTestcase,
		loading: createTestcaseMutation.isPending,
		error: createTestcaseMutation.error?.message || null,
	};
}
