import { OrganizationRole, type PrismaClient, ProjectRole } from "@/prisma";
import type { ProjectCreateType, ProjectUpdateType } from "@/services/validate";
import crypto from "node:crypto";

export class ProjectRepository {
	private prisma: PrismaClient;

	constructor(prisma: PrismaClient) {
		this.prisma = prisma;
	}

	public async getProjectByID(projID: number) {
		return await this.prisma.project.findUnique({
			where: {
				id: projID,
			},
		});
	}

	public async getProjectMembers(projID: number) {
		return await this.prisma.projectMember.findMany({
			where: {
				projectId: projID,
			},
			include: {
				user: {
					select: {
						id: true,
						email: true,
						name: true,
						picture: true,
					},
				},
			},
		});
	}

	public async createSharedProject(orgID: number, data: ProjectCreateType) {
		const project = await this.prisma.project.create({
			data: {
				name: data.name,
				description: data.description,
				initial: false,
				organization: {
					connect: {
						id: orgID,
					},
				},
			},
		});

		// assign all ADMINS of the organization to the project
		const organizationAdmins = await this.prisma.organizationMember.findMany({
			where: {
				organizationId: orgID,
				role: OrganizationRole.ADMIN,
			},
		});

		// create project members data
		const projectMembersData = organizationAdmins.map((member) => ({
			userId: member.userId,
			projectId: project.id,
			role: ProjectRole.ADMIN,
		}));

		// add all organization admins to the project as admins
		await this.prisma.projectMember.createMany({
			data: projectMembersData,
		});

		return project;
	}

	public async getMemberByUserId(projID: number, userId: number) {
		return await this.prisma.projectMember.findUnique({
			where: {
				userId_projectId: {
					userId: userId,
					projectId: projID,
				},
			},
		});
	}

	public async getMemberById(projectId: number, memberId: number) {
		return await this.prisma.projectMember.findUnique({
			where: {
				id: memberId,
				projectId: projectId,
			},
		});
	}

	public async updateMemberRole(memberId: number, newRole: ProjectRole) {
		return await this.prisma.projectMember.update({
			where: {
				id: memberId,
			},
			data: {
				role: newRole,
			},
		});
	}

	public async addMember(projID: number, userId: number, role: ProjectRole) {
		return await this.prisma.projectMember.create({
			data: {
				projectId: projID,
				userId,
				role,
			},
		});
	}

	public async deleteMember(projID: number, memberId: number) {
		return await this.prisma.projectMember.delete({
			where: {
				id: memberId,
				projectId: projID,
			},
			select: {
				id: true,
			},
		});
	}

	public async deleteProject(projectId: number, orgId: number) {
		return await this.prisma.project.delete({
			where: {
				id: projectId,
				organizationId: orgId,
			},
		});
	}

	public async removeFromAllProjects(orgId: number, userId: number) {
		return await this.prisma.projectMember.deleteMany({
			where: {
				project: {
					organizationId: orgId,
				},
				userId: userId,
			},
		});
	}

	public async getProjectApiKeys(projectId: number) {
		return await this.prisma.projectApiKey.findMany({
			where: { projectId },
			select: {
				id: true,
				name: true,
				publicKey: true,
				createdAt: true,
				lastUsed: true,
				author: {
					select: {
						id: true,
						name: true,
						email: true,
						picture: true,
					},
				},
			},
		});
	}

	public async getProjectApiKeysByOrganizationId(orgId: number) {
		return await this.prisma.projectApiKey.findMany({
			where: { project: { organizationId: orgId } },
			select: {
				id: true,
				name: true,
				publicKey: true,
				createdAt: true,
				lastUsed: true,
				project: {
					select: {
						id: true,
						name: true,
					},
				},
				author: {
					select: {
						id: true,
						name: true,
						email: true,
						picture: true,
					},
				},
			},
		});
	}

	public async newProjectApiKey(projectId: number, name: string, userId: number) {
		// Generate a 64-byte (128 characters) random key
		const key = crypto.randomBytes(64).toString("hex");
		// public key is first 8 and last 8 characters of the key
		const publicKey = `${key.slice(0, 5)}...${key.slice(-5)}`;

		return await this.prisma.projectApiKey.create({
			data: {
				name,
				key,
				publicKey,
				projectId,
				authorId: userId,
			},
		});
	}

	public async deleteProjectApiKeyById(id: number) {
		return await this.prisma.projectApiKey.delete({
			where: { id },
		});
	}

	public async getProjectbyApiKeyById(keyId: number) {
		return await this.prisma.project.findFirst({
			where: {
				apiKeys: {
					some: {
						id: keyId,
					},
				},
			},
		});
	}

	public async getProjectApiKeyByToken(token: string) {
		return await this.prisma.projectApiKey.findUnique({
			where: { key: token },
		});
	}

	public async updateProjectApiKeyLastUsed(keyId: number) {
		return await this.prisma.projectApiKey.update({
			where: { id: keyId },
			data: { lastUsed: new Date() },
		});
	}

	public async getProjectsByOrgId(orgId: number) {
		return await this.prisma.project.findMany({
			where: { organizationId: orgId },
		});
	}

	public async updateProject(projectId: number, data: ProjectUpdateType) {
		return await this.prisma.project.update({
			where: { id: projectId },
			data,
		});
	}

	// public async getApiKeyByToken(token: string) {
	// 	return await this.prisma.projectApiKey.findFirst({
	// 		where: { key: token },
	// 	});
	// }
}
