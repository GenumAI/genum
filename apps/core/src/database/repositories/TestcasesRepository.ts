import type { PrismaClient, TestCase } from "@/prisma";
import type { TestcasesCreateType, TestcasesUpdateType } from "@/services/validate";

export class TestcasesRepository {
	private prisma: PrismaClient;

	constructor(prisma: PrismaClient) {
		this.prisma = prisma;
	}

	public async getProjectTestcases(projectId: number) {
		return await this.prisma.testCase.findMany({
			where: {
				prompt: {
					projectId,
				},
			},
			include: {
				memory: {
					select: {
						id: true,
						key: true,
					},
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
				memory: true,
				files: {
					include: {
						file: true,
					},
				},
				placeholderValues: {
					include: { placeholderValue: { include: { placeholder: true } } },
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
		const { files, placeholders: _placeholders, ...testcaseData } = data;

		const testcase = await this.prisma.testCase.create({
			data: testcaseData,
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

	public async updateTestcaseByID(id: number, data: TestcasesUpdateType) {
		const { placeholders: _placeholders, ...testcaseData } = data;
		return await this.prisma.testCase.update({ where: { id }, data: testcaseData });
	}

	public async setPlaceholderSelection(
		testCaseId: number,
		rows: { placeholderId: number; placeholderValueId: number }[],
	) {
		return await this.prisma.$transaction(async (tx) => {
			await tx.testCasePlaceholderValue.deleteMany({ where: { testCaseId } });
			if (rows.length === 0) return;
			await tx.testCasePlaceholderValue.createMany({
				data: rows.map((row) => ({ ...row, testCaseId })),
			});
		});
	}

	public async getTestcasesByPromptId(promptId: number) {
		return await this.prisma.testCase.findMany({
			where: { promptId },
			include: {
				memory: {
					select: {
						id: true,
						key: true,
					},
				},
				files: {
					include: {
						file: true,
					},
				},
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
