/** biome-ignore-all lint/correctness/noUnusedFunctionParameters: WIP */
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { db } from "../database/db";
import type { OrganizationRole, ProjectRole } from "@/prisma";
import { isLocalInstance } from "@/utils/env";

export type ContextScope = "user" | "org" | "project";

export function createAuthMiddleware() {
	const hasProjectRole =
		(role: ProjectRole) => async (req: Request, res: Response, next: NextFunction) => {
			// const member = req.genumMeta.projectMember;

			// if (!member) {
			// 	res.status(403).json({ error: 'Not a member' });
			// 	return;
			// }

			// if (member.role !== role) {
			// 	res.status(403).json({ error: 'Not enough permissions' });
			// 	return;
			// }

			next();
		};

	const hasOrganizationRole =
		(role: OrganizationRole) => async (req: Request, res: Response, next: NextFunction) => {
			// feature: teamwork
			// we do not check any role
			// const member = req.genumMeta.organizationMember;

			// if (!member) {
			// 	res.status(403).json({ error: 'Not a member' });
			// 	return;
			// }

			// if (member.role !== role) {
			// 	res.status(403).json({ error: 'Wrong role' });
			// 	return;
			// }

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
		hasProjectRole,
		hasOrganizationRole,
		context,
		attachProjContext,
		requireSystemUser,
	};
}
