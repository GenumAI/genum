import { Prisma } from "@/prisma";
import type { PrismaClient, TestCase } from "@/prisma";
import type { TestcasesCreateType, TestcasesUpdateType } from "@/services/validate";

/**
 * `expectedSteps`, `lastSteps` and `stepsConfig` are `Json?` columns. Prisma needs three
 * different things from us for three different intents, and conflating any two of them is
 * the bug this function exists to prevent:
 *
 *   - absent (`undefined`)  -> leave the column alone
 *   - a value               -> write it
 *   - `null`                -> clear the column, which Prisma spells `Prisma.DbNull`
 *
 * A plain `null` cast to `InputJsonValue` is rejected at runtime, which is why clearing a
 * trajectory was impossible through the API before this.
 */
export function trajectoryColumns(data: {
	expectedSteps?: unknown;
	lastSteps?: unknown;
	stepsConfig?: unknown;
	lastMismatches?: unknown;
}): {
	expectedSteps?: Prisma.InputJsonValue | typeof Prisma.DbNull;
	lastSteps?: Prisma.InputJsonValue | typeof Prisma.DbNull;
	stepsConfig?: Prisma.InputJsonValue | typeof Prisma.DbNull;
	lastMismatches?: Prisma.InputJsonValue | typeof Prisma.DbNull;
} {
	const column = (value: unknown) =>
		value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);

	return {
		...(data.expectedSteps !== undefined ? { expectedSteps: column(data.expectedSteps) } : {}),
		...(data.lastSteps !== undefined ? { lastSteps: column(data.lastSteps) } : {}),
		...(data.stepsConfig !== undefined ? { stepsConfig: column(data.stepsConfig) } : {}),
		...(data.lastMismatches !== undefined
			? { lastMismatches: column(data.lastMismatches) }
			: {}),
	};
}

export class TestcasesRepository {
	private prisma: PrismaClient;

	constructor(prisma: PrismaClient) {
		this.prisma = prisma;
	}

	// `placeholderValues` is included here too, not just in getTestcasesByPromptId's
	// opt-in: this backs GET /testcases, the project-wide Testcases page's only data
	// source, which has no promptId to route through the opt-in call. Leaving it out
	// would silently misreport every pinned testcase on that page as unpinned -- the
	// UI would state "pins nothing" while the database holds a pin.
	public async getProjectTestcases(projectId: number) {
		return await this.prisma.testCase.findMany({
			where: {
				prompt: {
					projectId,
				},
			},
			include: {
				placeholderValues: {
					include: { placeholderValue: { include: { placeholder: true } } },
					orderBy: { placeholderId: "asc" },
				},
			},
			orderBy: {
				createdAt: "desc",
			},
		});
	}

	public async getTestcaseByID(id: number) {
		return await this.prisma.testCase.findUnique({
			where: { id },
			include: {
				prompt: true,
				files: {
					include: {
						file: true,
					},
				},
				placeholderValues: {
					include: { placeholderValue: { include: { placeholder: true } } },
					orderBy: { placeholderId: "asc" },
				},
			},
		});
	}

	public async getTestcaseByIDWithPrompt(id: number) {
		return await this.prisma.testCase.findUnique({
			where: { id },
			include: {
				prompt: { include: { languageModel: true } },
				files: {
					include: {
						file: true,
					},
				},
			},
		});
	}

	public async newTestcase(data: TestcasesCreateType & { files?: string[] }) {
		const {
			files,
			placeholders: _placeholders,
			expectedSteps,
			stepsConfig,
			...testcaseData
		} = data;

		const testcase = await this.prisma.testCase.create({
			data: {
				...testcaseData,
				...trajectoryColumns({ expectedSteps, stepsConfig }),
			},
		});

		// Create file associations if files are provided
		if (files && files.length > 0) {
			await this.prisma.testcaseFile.createMany({
				data: files.map((fileId) => ({
					testcaseId: testcase.id,
					fileId,
				})),
			});
		}

		return testcase;
	}

	public async deleteTestcaseByID(id: number): Promise<TestCase> {
		return await this.prisma.testCase.delete({
			where: { id },
		});
	}

	// Callers (runTestcase, updateTestcase) write this response straight into the
	// prompt-testcases list cache as a wholesale replacement of the cached entry, so it
	// must carry the same placeholderValues shape as that list -- an update response
	// missing the relation would read in the cache as "no pin", clearing the chips even
	// though nothing about the pin changed.
	// `lastMismatches` is not part of `TestcasesUpdateType` -- the schema is `.strict()`
	// and deliberately does not accept it from a client -- so the signature is widened
	// here to accept it from a caller that derived it from a run (or from the update
	// handler's own cascade), rather than smuggling it through the parsed request type.
	public async updateTestcaseByID(
		id: number,
		data: TestcasesUpdateType & { lastMismatches?: unknown },
	) {
		const {
			placeholders: _placeholders,
			expectedSteps,
			lastSteps,
			stepsConfig,
			lastMismatches,
			...testcaseData
		} = data;
		return await this.prisma.testCase.update({
			where: { id },
			data: {
				...testcaseData,
				...trajectoryColumns({ expectedSteps, lastSteps, stepsConfig, lastMismatches }),
			},
			include: {
				placeholderValues: {
					include: { placeholderValue: { include: { placeholder: true } } },
					orderBy: { placeholderId: "asc" },
				},
			},
		});
	}

	// Destructures rather than spreading `row` so a caller that passes richer rows (e.g.
	// PlaceholdersRepository.resolveSelection's `content`, kept there for the testcase
	// namer's extra context) cannot leak an extra column into `createMany` -- excess
	// property checks don't fire on a variable, only on an object literal, so a `{
	// ...row, testCaseId }` spread would have compiled fine and thrown at runtime the
	// moment Prisma saw an argument `TestCasePlaceholderValue` doesn't have.
	public async setPlaceholderSelection(
		testCaseId: number,
		rows: { placeholderId: number; placeholderValueId: number }[],
	) {
		return await this.prisma.$transaction(async (tx) => {
			await tx.testCasePlaceholderValue.deleteMany({ where: { testCaseId } });
			if (rows.length === 0) return;
			await tx.testCasePlaceholderValue.createMany({
				data: rows.map(({ placeholderId, placeholderValueId }) => ({
					placeholderId,
					placeholderValueId,
					testCaseId,
				})),
			});
		});
	}

	// `includePlaceholders` is opt-in and defaults to off. getTestcasesByPromptId is
	// called from several places that only read status/summary fields (getProjectPrompts
	// and getPromptById's status-count reducers, the prompt-auditor and assertion-editor
	// context builders in ai/runner/system.ts) -- none of them touch placeholderValues,
	// and the nested join isn't free. It is turned on in exactly one place:
	// PromptsController.getTestcasesByPromptId (the `GET /prompts/:id/testcases` route),
	// which backs the playground's testcase list and is what the placeholder chips seed
	// their pin from (Task 9 fix round 2).
	public async getTestcasesByPromptId(
		promptId: number,
		options?: { includePlaceholders?: boolean },
	) {
		return await this.prisma.testCase.findMany({
			where: { promptId },
			include: {
				files: {
					include: {
						file: true,
					},
				},
				...(options?.includePlaceholders
					? {
							placeholderValues: {
								include: { placeholderValue: { include: { placeholder: true } } },
								orderBy: { placeholderId: "asc" as const },
							},
						}
					: {}),
			},
			orderBy: {
				createdAt: "desc",
			},
		});
	}

	public async addFileToTestcase(testcaseId: number, fileId: string) {
		return await this.prisma.testcaseFile.create({
			data: {
				testcaseId,
				fileId,
			},
			include: {
				file: true,
			},
		});
	}

	public async removeFileFromTestcase(testcaseId: number, fileId: string) {
		return await this.prisma.testcaseFile.deleteMany({
			where: {
				testcaseId,
				fileId,
			},
		});
	}

	public async countTestcasesByDate(startDate: Date, endDate: Date) {
		return await this.prisma.testCase.count({
			where: {
				createdAt: {
					gte: startDate,
					lte: endDate,
				},
			},
		});
	}
}
