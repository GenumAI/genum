import { testcasesApi } from "@/api/testcases/testcases.api";
import { useMutation } from "@tanstack/react-query";

export interface TestcasePayload {
	promptId: number;
	input: string;
	expectedOutput: string;
	lastOutput?: string;
	name?: string;
	memoryId?: number | null;
}

export function useCreateTestcase() {
	const createTestcaseMutation = useMutation({
		mutationFn: async (payload: TestcasePayload) => {
			return await testcasesApi.createTestcase(payload);
		},
	});

	const createTestcase = async (payload: TestcasePayload): Promise<boolean> => {
		try {
			await createTestcaseMutation.mutateAsync(payload);
			return true;
		} catch (err: any) {
			console.error("Create testcase error:", err);
			return false;
		}
	};

	return {
		createTestcase,
		loading: createTestcaseMutation.isPending,
		error: createTestcaseMutation.error?.message || null,
	};
}
