import type { Request, Response } from "express";
import { db } from "@/database/db";
import { OrganizationRole } from "@/prisma";
import { ProjectService } from "@/services/project.service";
import {
	getProjectUsageWithDailyStats,
	getProjectLogs,
	type LogDocument,
	type PromptUsageStats,
} from "../services/logger/logger";
import {
	numberSchema,
	ProjectMemberCreateSchema,
	ProjectMemberUpdateSchema,
	stringSchema,
	ProjectUsageStatsSchema,
	ProjectLogsQuerySchema,
	ProjectUpdateSchema,
} from "@/services/validate";
import type { LogLevel, SourceType } from "@/services/logger";

export class ProjectController {
	private readonly projectService: ProjectService;

	constructor() {
		this.projectService = new ProjectService(db);
	}

	public async getProjectDetails(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;

		const project = await db.project.getProjectByID(metadata.projID);

		res.status(200).json({
			project,
		});
	}

	public async updateProject(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const data = ProjectUpdateSchema.parse(req.body);

		const updatedProject = await db.project.updateProject(metadata.projID, data);

		res.status(200).json({ project: updatedProject });
	}
	public async getProjectMembers(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;

		const members = await db.project.getProjectMembers(metadata.projID);

		res.status(200).json({
			members,
		});
	}

	public async deleteProjectMember(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const memberId = numberSchema.parse(req.params.memberId);

		const member = await db.project.getMemberById(metadata.projID, memberId);
		if (!member) {
			res.status(404).json({ error: "Member not found" });
			return;
		}

		if (member.userId === metadata.userID) {
			res.status(400).json({ error: "You cannot delete yourself" });
			return;
		}

		const orgMember = await db.organization.getMemberByUserId(metadata.orgID, member.userId);
		if (
			orgMember?.role === OrganizationRole.OWNER ||
			orgMember?.role === OrganizationRole.ADMIN
		) {
			res.status(400).json({
				error: "Cannot remove an organization owner or admin from a project",
			});
			return;
		}

		await this.projectService.deleteMember(metadata.projID, memberId);

		res.status(200).json({ message: "Member deleted" });
	}

	public async addProjectMember(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const { userId, role } = ProjectMemberCreateSchema.parse(req.body);

		// check if user exists
		const user = await db.users.getUserByID(userId);
		if (!user) {
			res.status(404).json({ error: "User is not found" });
			return;
		}

		// check if member already exists
		const member = await db.project.getMemberByUserId(metadata.projID, userId);
		if (member) {
			res.status(400).json({ error: "Member already exists" });
			return;
		}

		// add member
		const newMember = await db.project.addMember(metadata.projID, userId, role);

		res.status(201).json({ member: newMember });
	}

	public async updateProjectMemberRole(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const memberId = numberSchema.parse(req.params.memberId);
		const { role: newRole } = ProjectMemberUpdateSchema.parse(req.body);

		const projectMember = await db.project.getMemberById(metadata.projID, memberId);
		if (!projectMember) {
			res.status(404).json({ error: "Member not found" });
			return;
		}

		const orgMember = await db.organization.getMemberByUserId(
			metadata.orgID,
			projectMember.userId,
		);
		if (!orgMember) {
			res.status(404).json({ error: "Organization member not found" });
			return;
		}

		if (
			orgMember.role === OrganizationRole.OWNER ||
			orgMember.role === OrganizationRole.ADMIN
		) {
			res.status(403).json({
				error: "Cannot change project role of an organization owner or admin",
			});
			return;
		}

		const updatedMember = await db.project.updateMemberRole(memberId, newRole);

		res.status(200).json({ member: updatedMember });
	}

	public async getProjectApiKeys(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const apiKeys = await db.project.getProjectApiKeys(metadata.projID);
		res.status(200).json({ apiKeys });
	}

	public async createProjectApiKey(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const name = stringSchema.parse(req.body.name);
		const apiKey = await db.project.newProjectApiKey(metadata.projID, name, metadata.userID);
		res.status(200).json({ apiKey });
	}

	public async deleteProjectApiKey(req: Request, res: Response) {
		const apiKeyId = numberSchema.parse(req.params.apiKeyId);
		await db.project.deleteProjectApiKeyById(apiKeyId);
		res.status(200).json({ id: apiKeyId });
	}

	public async getProjectDetailedUsageStats(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const { fromDate, toDate } = ProjectUsageStatsSchema.parse(req.query);

		const stats = await getProjectUsageWithDailyStats(
			metadata.orgID,
			metadata.projID,
			fromDate,
			toDate,
		);

		const promptNamesAll = await db.prompts.getPromptNames(metadata.projID);
		const usedPromptIds = new Set(
			(stats.prompts || []).map((p: PromptUsageStats) => p.prompt_id),
		);
		const promptNames = promptNamesAll.filter((p) => usedPromptIds.has(p.id));
		const userIds = Array.from(
			new Set((stats.users || []).map((u) => u.user_id).filter((id) => id != null)),
		);
		const users = await db.users.getUsersByIDs(userIds);
		const userNameById = new Map(users.map((u) => [u.id, u.name]));
		const usersWithNames = (stats.users || []).map((u) => ({
			...u,
			user_name: userNameById.get(u.user_id) ?? null,
		}));

		res.status(200).json({
			...stats,
			users: usersWithNames,
			promptNames,
		});
	}

	public async getProjectLogs(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const { page, pageSize, fromDate, toDate, logLevel, promptId, source, query } =
			ProjectLogsQuerySchema.parse(req.query);

		const logs = await getProjectLogs(metadata.orgID, metadata.projID, page, pageSize, {
			fromDate,
			toDate,
			logLevel: logLevel as LogLevel,
			promptId,
			source: source as SourceType,
			query,
		});

		const promptNamesAll = await db.prompts.getPromptNames(metadata.projID);
		const usedPromptIds = new Set(
			(logs.logs || [])
				.map((log: LogDocument) => log.prompt_id)
				.filter((id: number | undefined) => id != null),
		);
		const promptNames = promptNamesAll.filter((p) => usedPromptIds.has(p.id));

		res.status(200).json({
			...logs,
			promptNames,
		});
	}
}
