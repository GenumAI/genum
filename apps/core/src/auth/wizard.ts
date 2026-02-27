/** biome-ignore-all lint/correctness/noUnusedFunctionParameters: WIP */
import type { RequestHandler } from "express";
import { db } from "../database/db";
import { OrganizationRole, ProjectRole } from "@/prisma";
import { isLocalInstance } from "@/utils/env";

export type ContextScope = "user" | "org" | "project";

const ORG_ROLE_RANK: Record<OrganizationRole, number> = {
	[OrganizationRole.READER]: 0,
	[OrganizationRole.ADMIN]: 1,
	[OrganizationRole.OWNER]: 2,
};

const PROJ_ROLE_RANK: Record<ProjectRole, number> = {
	[ProjectRole.MEMBER]: 0,
	[ProjectRole.ADMIN]: 1,
};

export function createAuthMiddleware() {
	const hasMinOrgRole =
		(minRole: OrganizationRole): RequestHandler =>
		async (req, res, next) => {
			const member = req.genumMeta.organizationMember;
			if (!member || ORG_ROLE_RANK[member.role] < ORG_ROLE_RANK[minRole]) {
				res.status(403).json({ error: "Insufficient permissions" });
				return;
			}
			next();
		};

	const hasMinProjectRole =
		(minRole: ProjectRole): RequestHandler =>
		async (req, res, next) => {
			const member = req.genumMeta.projectMember;
			if (!member || PROJ_ROLE_RANK[member.role] < PROJ_ROLE_RANK[minRole]) {
				res.status(403).json({ error: "Insufficient permissions" });
				return;
			}
			next();
		};

	const attachUserContext: RequestHandler = async (req, res, next) => {
		try {
			const metadata = req.genumMeta.ids;
			const payload = req.auth?.payload;

			const user = await db.auth.getUserById(metadata.userID);
			// Skip sub/authID check for self-hosted instances
			if (!user || (!isLocalInstance() && payload?.sub !== user.authID)) {
				res.status(404).json({ error: "User not found" });
				return;
			}

			req.genumMeta.user = user;
			next();
		} catch (error) {
			next(error);
		}
	};

	const attachOrgContext: RequestHandler = async (req, res, next) => {
		try {
			const metadata = req.genumMeta.ids;

			const orgContext = await db.auth.getUserOrganizationContext(
				metadata.userID,
				metadata.orgID,
			);
			if (!orgContext) {
				res.status(404).json({ error: "Not found" });
				return;
			}

			const { organization: organizationWithQuota, ...member } = orgContext;
			const { quota, ...organization } = organizationWithQuota;
			if (!quota) {
				throw new Error("Quota not found. Please contact support.");
			}

			req.genumMeta.organizationMember = member;
			req.genumMeta.organization = organization;
			req.genumMeta.organizationQuota = quota;

			next();
		} catch (error) {
			console.error(`error attaching org context`, error);
			console.log((error as Error).stack);
			res.status(500).json({ error: "Internal server error" });
			return;
		}
	};

	const attachProjContext: RequestHandler = async (req, res, next) => {
		try {
			const metadata = req.genumMeta.ids;
			const projContext = await db.auth.getUserProjectContext(
				metadata.userID,
				metadata.orgID,
				metadata.projID,
			);
			if (!projContext) {
				res.status(404).json({ error: "Not found" });
				return;
			}

			const { project, ...member } = projContext;

			req.genumMeta.projectMember = member;
			req.genumMeta.project = project;

			next();
		} catch (error) {
			console.error(`error attaching proj context`, error);
			console.log((error as Error).stack);
			res.status(500).json({ error: "Internal server error" });
			return;
		}
	};

	const requireSystemUser: RequestHandler = async (req, res, next) => {
		try {
			const metadata = req.genumMeta.ids;
			const systemUserId = await db.system.getSystemUserId();

			if (!systemUserId || metadata.userID !== systemUserId) {
				res.status(403).json({ error: "Forbidden. System user access required." });
				return;
			}

			next();
		} catch (error) {
			console.error(`error checking system user`, error);
			res.status(500).json({ error: "Internal server error" });
			return;
		}
	};

	const context = (scope: ContextScope): RequestHandler[] => {
		const chain: RequestHandler[] = [attachUserContext];

		if (scope === "org" || scope === "project") {
			chain.push(attachOrgContext);
		}
		if (scope === "project") {
			chain.push(attachProjContext);
		}

		return chain;
	};

	return {
		hasMinOrgRole,
		hasMinProjectRole,
		context,
		attachProjContext,
		requireSystemUser,
	};
}
