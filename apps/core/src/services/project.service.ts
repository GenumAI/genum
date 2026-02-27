import type { Database } from "@/database/db";

/**
 * Project business logic.
 * When a user is removed from a project (or from the whole org), their API keys
 * for that project/org are deleted so they no longer have access.
 */
export class ProjectService {
	constructor(private readonly db: Database) {}

	/**
	 * Remove a member from a project and delete all their API keys for this project.
	 */
	public async deleteMember(projID: number, memberId: number): Promise<void> {
		await this.db.project.deleteMember(projID, memberId);
	}

	/**
	 * Remove a user from all projects in an organization and delete all their
	 * API keys in those projects (e.g. when removing the user from the org).
	 */
	public async removeUserFromAllProjects(orgId: number, userId: number): Promise<void> {
		await this.db.project.removeFromAllProjects(orgId, userId);
	}
}
