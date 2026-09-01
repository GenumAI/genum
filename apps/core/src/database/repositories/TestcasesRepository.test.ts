import { describe, it, expect, vi, beforeEach } from "vitest";
import { TestcasesRepository } from "./TestcasesRepository";
import type { PrismaClient } from "@/prisma";

function makeMockPrisma() {
	return {
		testCase: {
			update: vi.fn(),
		},
	};
}

// Regression guard for Task 9 fix round 3: runTestcase and updateTestcase both write
// this method's return value straight into the prompt-testcases list cache as a
// wholesale replacement of the cached entry (see usePlaygroundPromptRun.ts and
// usePlaygroundTestcase.ts on the frontend). A response missing `placeholderValues`
// reads in that cache as "no pin", silently clearing the playground's placeholder
// chips on every run and every save even though nothing about the pin changed. This
// test fails loudly the moment a future refactor drops the include.
describe("TestcasesRepository.updateTestcaseByID", () => {
	let mockPrisma: ReturnType<typeof makeMockPrisma>;
	let repo: TestcasesRepository;

	beforeEach(() => {
		mockPrisma = makeMockPrisma();
		repo = new TestcasesRepository(mockPrisma as unknown as PrismaClient);
	});

	it("includes placeholderValues (with the placeholder's key) in the update query", async () => {
		mockPrisma.testCase.update.mockResolvedValue({
			id: 5,
			placeholderValues: [
				{
					placeholderId: 5,
					placeholderValueId: 9,
					placeholderValue: {
						id: 9,
						name: "true",
						placeholder: { id: 5, key: "admin_role" },
					},
				},
			],
		});

		const result = await repo.updateTestcaseByID(5, { name: "renamed" });

		expect(mockPrisma.testCase.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 5 },
				include: expect.objectContaining({
					placeholderValues: expect.objectContaining({
						include: { placeholderValue: { include: { placeholder: true } } },
					}),
				}),
			}),
		);
		expect(result.placeholderValues).toEqual([
			expect.objectContaining({
				placeholderValue: expect.objectContaining({
					name: "true",
					placeholder: expect.objectContaining({ key: "admin_role" }),
				}),
			}),
		]);
	});

	it("still strips `placeholders` from the write payload (it is resolved separately)", async () => {
		mockPrisma.testCase.update.mockResolvedValue({ id: 5, placeholderValues: [] });

		await repo.updateTestcaseByID(5, {
			name: "renamed",
			placeholders: { admin_role: "true" },
		});

		const call = mockPrisma.testCase.update.mock.calls[0][0];
		expect(call.data).not.toHaveProperty("placeholders");
		expect(call.data).toEqual({ name: "renamed" });
	});
});
