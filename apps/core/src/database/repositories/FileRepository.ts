import type { PrismaClient } from "@/prisma";

export class FileRepository {
	private prisma: PrismaClient;

	constructor(prisma: PrismaClient) {
		this.prisma = prisma;
	}

	/**
	 * Create a new file record
	 */
	public async createFile(data: {
		key: string;
		name: string;
		size: number;
		contentType: string;
		projectId: number;
	}) {
		return await this.prisma.fileObject.create({
			data,
		});
	}

	/**
	 * Get file by ID
	 */
	public async getFileById(id: string, projectId: number) {
		return await this.prisma.fileObject.findUnique({
			where: { id, projectId },
		});
	}

	/**
	 * Get file by key
	 */
	public async getFileByKey(key: string, projectId: number) {
		return await this.prisma.fileObject.findUnique({
			where: { key, projectId },
		});
	}

	/**
	 * List all files for a project
	 */
	public async listProjectFiles(projectId: number) {
		return await this.prisma.fileObject.findMany({
			where: { projectId },
			orderBy: {
				createdAt: "desc",
			},
		});
	}

	/**
	 * Delete file by ID
	 */
	public async deleteFile(id: string, projectId: number) {
		return await this.prisma.fileObject.delete({
			where: { id, projectId },
		});
	}

	/**
	 * Delete file by key
	 */
	public async deleteFileByKey(key: string, projectId: number) {
		return await this.prisma.fileObject.delete({
			where: { key, projectId },
		});
	}

	/**
	 * Check if file exists by key
	 */
	public async fileExistsByKey(key: string, projectId: number): Promise<boolean> {
		const file = await this.prisma.fileObject.findUnique({
			where: { key, projectId },
			select: { id: true },
		});
		return file !== null;
	}
}
