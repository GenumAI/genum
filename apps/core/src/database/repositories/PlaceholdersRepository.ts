import type { PrismaClient } from "@/prisma";
import type {
	PlaceholderCreateType,
	PlaceholderUpdateType,
	PlaceholderValueCreateType,
	PlaceholderValueUpdateType,
} from "@/services/validate";

export class PlaceholdersRepository {
	private prisma: PrismaClient;

	constructor(prisma: PrismaClient) {
		this.prisma = prisma;
	}

	public async getPlaceholdersByPromptID(promptId: number) {
		return await this.prisma.placeholder.findMany({
			where: { promptId },
			include: { values: { orderBy: { id: "asc" } } },
			orderBy: { id: "asc" },
		});
	}

	public async getPlaceholderByIDAndPromptId(id: number, promptId: number) {
		return await this.prisma.placeholder.findFirst({
			where: { id, promptId },
			include: { values: { orderBy: { id: "asc" } } },
		});
	}

	public async getPlaceholderByKeyAndPromptId(key: string, promptId: number) {
		return await this.prisma.placeholder.findFirst({ where: { key, promptId } });
	}

	public async createPlaceholder(promptId: number, data: PlaceholderCreateType) {
		return await this.prisma.placeholder.create({
			data: { key: data.key, description: data.description ?? null, promptId },
			include: { values: true },
		});
	}

	public async updatePlaceholderByID(id: number, data: PlaceholderUpdateType) {
		return await this.prisma.placeholder.update({
			where: { id },
			data,
			include: { values: { orderBy: { id: "asc" } } },
		});
	}

	public async deletePlaceholderByID(id: number) {
		return await this.prisma.placeholder.delete({ where: { id } });
	}

	public async getValueByIDAndPlaceholderId(id: number, placeholderId: number) {
		return await this.prisma.placeholderValue.findFirst({ where: { id, placeholderId } });
	}

	// isDefault is guarded by a partial unique index, so clearing the previous default
	// and setting the new one must happen in one transaction or the write can fail
	// against a default that is on its way out.
	public async createValue(placeholderId: number, data: PlaceholderValueCreateType) {
		return await this.prisma.$transaction(async (tx) => {
			if (data.isDefault) {
				await tx.placeholderValue.updateMany({
					where: { placeholderId, isDefault: true },
					data: { isDefault: false },
				});
			}

			return await tx.placeholderValue.create({
				data: {
					placeholderId,
					name: data.name,
					content: data.content,
					isDefault: data.isDefault ?? false,
				},
			});
		});
	}

	public async updateValueByID(id: number, data: PlaceholderValueUpdateType) {
		return await this.prisma.$transaction(async (tx) => {
			if (data.isDefault) {
				const current = await tx.placeholderValue.findUniqueOrThrow({ where: { id } });
				await tx.placeholderValue.updateMany({
					where: { placeholderId: current.placeholderId, isDefault: true },
					data: { isDefault: false },
				});
			}

			return await tx.placeholderValue.update({ where: { id }, data });
		});
	}

	public async deleteValueByID(id: number) {
		return await this.prisma.placeholderValue.delete({ where: { id } });
	}
}
