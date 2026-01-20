import type { TestCase } from "@/types/TestСase";

export const calculateTestcaseStatusCounts = (testcases: TestCase[]) => {
	const counts = { ok: 0, nok: 0, needRun: 0 };

	for (const tc of testcases) {
		if (tc.status === "OK") {
			counts.ok++;
		} else if (tc.status === "NOK") {
			counts.nok++;
		} else if (tc.status === "NEED_RUN") {
			counts.needRun++;
		}
	}

	return counts;
};
