import { testcasesApi } from "@/api/testcases/testcases.api";
import { useMutation } from "@tanstack/react-query";

export interface TestcasePayload {
	promptId: number;
	input: string;
	expectedOutput: string;
	lastOutput?: string;
	name?: string;
	memoryId?: number | null;
	files?: string[];
	placeholders?: Record<string, string>;
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
