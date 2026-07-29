import type { Database } from "@/database/db";
import { OrganizationRole, ProjectRole } from "@/prisma";

export type MailOnboardingContext = {
	user: { id: number };
	organizations: Array<{
		id: number;
		name: string;
		personal: boolean;
		role: OrganizationRole;
		projects: Array<{ id: number; name: string }>;
	}>;
};

export type MailCreateProjectResult =
	| { ok: true; projectId: number; created: boolean }
	| { ok: false; reason: "user_not_found" | "forbidden" };

export type MailMintKeyResult =
	| { ok: true; key: string }
	| { ok: false; reason: "user_not_found" | "forbidden" };

/**
 * Acting-for-user operations behind /service/mail/*. Every method resolves the
 * user by Auth0 sub first and enforces membership/roles itself — the service
 * bearer key alone must never grant anything a given sub could not do in the
 * Lab UI.
 */
export class MailOnboardingService {
	constructor(private readonly db: Database) {}

	public async getContext(sub: string): Promise<MailOnboardingContext | null> {
		const user = await this.db.users.getUserByAuthID(sub);
		if (!user) {
			return null;
		}

		const context = await this.db.users.getUserContextByID(user.id);
		return {
			user: { id: context.id },
			organizations: context.organizationMemberships.map((membership) => ({
				id: membership.organization.id,
				name: membership.organization.name,
				personal: membership.organization.personal,
				role: membership.role,
				projects: membership.organization.projects.map((project) => ({
					id: project.id,
					name: project.name,
				})),
			})),
		};
	}

	public async createProject(
		sub: string,
		orgId: number,
		name: string,
	): Promise<MailCreateProjectResult> {
		const user = await this.db.users.getUserByAuthID(sub);
		if (!user) {
			return { ok: false, reason: "user_not_found" };
		}

		const member = await this.db.organization.getMemberByUserId(orgId, user.id);
		const canCreate =
			member?.role === OrganizationRole.ADMIN || member?.role === OrganizationRole.OWNER;
		if (!canCreate) {
			return { ok: false, reason: "forbidden" };
		}

		// Find-or-create by (orgId, name) — this is what makes the mail-side
		// setup retry-safe: a re-run after a mid-flight failure converges on
		// the same project instead of minting a duplicate.
		const existing = await this.db.project.findProjectByOrgAndName(orgId, name);
		if (existing) {
			const projectMember = await this.db.project.getMemberByUserId(existing.id, user.id);
			if (!projectMember) {
				await this.db.project.addMember(existing.id, user.id, ProjectRole.ADMIN);
			}
			return { ok: true, projectId: existing.id, created: false };
		}

		const project = await this.db.project.createSharedProject(orgId, {
			name,
			description: "Created by Genum Mail onboarding",
		});
		return { ok: true, projectId: project.id, created: true };
	}

	public async mintProjectApiKey(
		sub: string,
		projectId: number,
		name: string,
	): Promise<MailMintKeyResult> {
		const user = await this.db.users.getUserByAuthID(sub);
		if (!user) {
			return { ok: false, reason: "user_not_found" };
		}

		const member = await this.db.project.getMemberByUserId(projectId, user.id);
		if (!member) {
			return { ok: false, reason: "forbidden" };
		}

		const apiKey = await this.db.project.newProjectApiKey(projectId, name, user.id);
		return { ok: true, key: apiKey.key };
	}
}
