import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/prisma";
import type { PrismaClient } from "@/prisma";
import { TestcasesRepository, trajectoryColumns } from "./TestcasesRepository";

function makeMockPrisma() {
	return {
		testCase: {
			create: vi.fn(),
			update: vi.fn(),
			findMany: vi.fn(),
		},
		testcaseFile: {
			createMany: vi.fn(),
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

	// A run writes the trajectory it just produced through this method. The columns are
	// `Json?`, so they have to be re-stated for Prisma's input type rather than spread
	// in -- a silent drop here would leave the UI diffing against nothing.
	it("writes the trajectory a run produced", async () => {
		mockPrisma.testCase.update.mockResolvedValue({ id: 5, placeholderValues: [] });
		const lastSteps = [{ kind: "final" as const, text: "It is 12°" }];

		await repo.updateTestcaseByID(5, { lastOutput: "It is 12°", lastSteps });

		expect(mockPrisma.testCase.update.mock.calls[0][0].data).toEqual({
			lastOutput: "It is 12°",
			lastSteps,
		});
	});
});

// A trajectory testcase copies the steps it pins into PostgreSQL (results included) so
// the test outlives the ClickHouse retention the trajectory itself lives under. A
// nullable column nothing writes is not a delivered field: pin the write.
describe("TestcasesRepository.newTestcase", () => {
	let mockPrisma: ReturnType<typeof makeMockPrisma>;
	let repo: TestcasesRepository;

	beforeEach(() => {
		mockPrisma = makeMockPrisma();
		repo = new TestcasesRepository(mockPrisma as unknown as PrismaClient);
	});

	it("writes the pinned trajectory and its config", async () => {
		mockPrisma.testCase.create.mockResolvedValue({ id: 5 });
		const expectedSteps = [
			{ kind: "tool_call" as const, name: "get_weather", recordedResult: '{"temp":12}' },
			{ kind: "final" as const, text: "It is 12°" },
		];

		await repo.newTestcase({
			name: "t",
			promptId: 1,
			input: "i",
			expectedOutput: "e",
			lastOutput: "",
			expectedSteps,
			stepsConfig: { orderMatters: true },
		});

		expect(mockPrisma.testCase.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				expectedSteps,
				stepsConfig: { orderMatters: true },
			}),
		});
	});

	it("leaves a text testcase's trajectory columns unset", async () => {
		mockPrisma.testCase.create.mockResolvedValue({ id: 5 });

		await repo.newTestcase({
			name: "t",
			promptId: 1,
			input: "i",
			expectedOutput: "e",
			lastOutput: "",
		});

		const data = mockPrisma.testCase.create.mock.calls[0][0].data;
		expect(data.expectedSteps).toBeUndefined();
		expect(data.stepsConfig).toBeUndefined();
	});
});

// Regression guard for Task 10 fix round 2: this is the project-wide Testcases
// page's only data source (GET /testcases has no promptId to route through
// getTestcasesByPromptId's opt-in). Losing this include once already made every
// pinned testcase on that page silently read as unpinned -- the UI stating "pins
// nothing" while the database held a pin.
describe("TestcasesRepository.getProjectTestcases", () => {
	let mockPrisma: ReturnType<typeof makeMockPrisma>;
	let repo: TestcasesRepository;

	beforeEach(() => {
		mockPrisma = makeMockPrisma();
		repo = new TestcasesRepository(mockPrisma as unknown as PrismaClient);
	});

	it("includes placeholderValues (with the placeholder's key) in the query", async () => {
		mockPrisma.testCase.findMany.mockResolvedValue([]);

		await repo.getProjectTestcases(1);

		expect(mockPrisma.testCase.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				include: expect.objectContaining({
					placeholderValues: expect.objectContaining({
						include: { placeholderValue: { include: { placeholder: true } } },
					}),
				}),
			}),
		);
	});
});

// Regression guard for Task 10 fix round 2: `getProjectTestcases`'s include had no
// test pinning it and it went missing once already. Pin both branches of this
// method's own opt-in so the same class of regression can't happen here either.
describe("TestcasesRepository.getTestcasesByPromptId", () => {
	let mockPrisma: ReturnType<typeof makeMockPrisma>;
	let repo: TestcasesRepository;

	beforeEach(() => {
		mockPrisma = makeMockPrisma();
		repo = new TestcasesRepository(mockPrisma as unknown as PrismaClient);
	});

	it("includes placeholderValues when includePlaceholders is true", async () => {
		mockPrisma.testCase.findMany.mockResolvedValue([]);

		await repo.getTestcasesByPromptId(1, { includePlaceholders: true });

		const call = mockPrisma.testCase.findMany.mock.calls[0][0];
		expect(call.include).toHaveProperty("placeholderValues");
		expect(call.include.placeholderValues).toEqual(
			expect.objectContaining({
				include: { placeholderValue: { include: { placeholder: true } } },
			}),
		);
	});

	it("omits placeholderValues when includePlaceholders is false or unset", async () => {
		mockPrisma.testCase.findMany.mockResolvedValue([]);

		await repo.getTestcasesByPromptId(1);
		let call = mockPrisma.testCase.findMany.mock.calls[0][0];
		expect(call.include).not.toHaveProperty("placeholderValues");

		mockPrisma.testCase.findMany.mockClear();
		await repo.getTestcasesByPromptId(1, { includePlaceholders: false });
		call = mockPrisma.testCase.findMany.mock.calls[0][0];
		expect(call.include).not.toHaveProperty("placeholderValues");
	});
});

describe("trajectoryColumns", () => {
	it("omits a field the caller did not mention", () => {
		expect(trajectoryColumns({})).toEqual({});
	});

	it("passes a value through unchanged", () => {
		const steps = [{ kind: "tool_call", name: "search" }];
		expect(trajectoryColumns({ expectedSteps: steps })).toEqual({ expectedSteps: steps });
	});

	it("maps null to Prisma.DbNull so the column becomes SQL NULL", () => {
		// `null` cast to InputJsonValue is rejected by Prisma at runtime; DbNull is the
		// only way to clear a Json? column, and clearing it is how a trajectory testcase
		// becomes a text one again.
		expect(trajectoryColumns({ expectedSteps: null })).toEqual({
			expectedSteps: Prisma.DbNull,
		});
	});

	it("maps every trajectory column independently", () => {
		expect(
			trajectoryColumns({ expectedSteps: null, lastSteps: [], stepsConfig: null }),
		).toEqual({
			expectedSteps: Prisma.DbNull,
			lastSteps: [],
			stepsConfig: Prisma.DbNull,
		});
	});
});
