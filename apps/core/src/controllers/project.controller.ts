import type { Request, Response } from "express";
import { db } from "@/database/db";
import { OrganizationRole } from "@/prisma";
import { ProjectService } from "@/services/project.service";
import {
	getProjectUsageWithDailyStats,
	getLogDetail,
	getProjectLogs,
	getSessionSpans,
	type LogListEntry,
	type PromptUsageStats,
} from "../services/logger/logger";
import {
	numberSchema,
	ProjectMemberCreateSchema,
	ProjectMemberUpdateSchema,
	stringSchema,
	sessionIdSchema,
	ProjectUsageStatsSchema,
	ProjectLogsQuerySchema,
	ProjectUpdateSchema,
	LogDetailQuerySchema,
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

		// The user must already belong to this organization; getUserByID alone is a
		// global lookup and would attach any user in the database to this project.
		const orgMember = await db.organization.getMemberByUserId(metadata.orgID, userId);
		if (!orgMember) {
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
		const metadata = req.genumMeta.ids;
		const apiKeyId = numberSchema.parse(req.params.apiKeyId);

		// Scope the delete to the caller's project. Without it any key id in the
		// instance could be deleted from any project.
		const { count } = await db.project.deleteProjectApiKeyById(apiKeyId, metadata.projID);
		if (count === 0) {
			res.status(404).json({ error: "API key is not found" });
			return;
		}

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

		// A key deleted after it was used stays in the logs but has no name to resolve
		const projectApiKeys = await db.project.getProjectApiKeys(metadata.projID);
		const apiKeyNameById = new Map(projectApiKeys.map((k) => [k.id, k.name]));
		const apiKeysWithNames = (stats.api_keys || []).map((k) => ({
			...k,
			api_key_name: apiKeyNameById.get(k.api_key_id) ?? null,
		}));

		res.status(200).json({
			...stats,
			users: usersWithNames,
			api_keys: apiKeysWithNames,
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
				.map((log: LogListEntry) => log.prompt_id)
				.filter((id: number | undefined) => id != null),
		);
		const promptNames = promptNamesAll.filter((p) => usedPromptIds.has(p.id));

		res.status(200).json({
			...logs,
			promptNames,
		});
	}

	// Named for the HTTP surface it serves, which kept the "trace" vocabulary; internally
	// it fetches a SESSION's spans across all its turns.
	public async getTraceSpans(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		// NOT `uuidSchema`. Our own sessions are derived UUIDs, but an ingested one is
		// identified by the sender's `gen_ai.conversation.id` (constrained in no way by the
		// GenAI conventions) or, absent that, by a 32-hex OTLP trace id. Validated as a
		// UUID, every ingested session 400s -- stored correctly and unreadable forever.
		const traceId = sessionIdSchema.parse(req.params.traceId);

		const spans = await getSessionSpans(traceId, metadata.orgID, metadata.projID);

		res.status(200).json({ spans });
	}

	/**
	 * The payload of a single log row on the project logs page. Here the project IS the
	 * access boundary, so it is part of the lookup -- and it also completes the sorting-key
	 * prefix (orgId, project_id, timestamp), so this reads one granule.
	 */
	public async getProjectLogDetail(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const { logId, timestamp } = LogDetailQuerySchema.parse(req.query);

		const detail = await getLogDetail({
			orgId: metadata.orgID,
			projectId: metadata.projID,
			logId,
			timestamp,
		});

		if (!detail) {
			return res.status(404).json({ error: "Log not found" });
		}

		res.status(200).json(detail);
	}
}
