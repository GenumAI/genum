import { ProjectRole } from "./project.api";

/**
 * Role rank mapping for project roles.
 * Higher number = more permissions.
 */
export const PROJECT_ROLE_RANK: Record<ProjectRole, number> = {
	[ProjectRole.MEMBER]: 0,
	[ProjectRole.ADMIN]: 1,
};

/**
 * Check if user has required project role level.
 * @param userRole - The user's current role in the project
 * @param requiredRole - The minimum role required
 * @returns true if user has access
 */
export function hasProjectAccess(
	userRole: ProjectRole,
	requiredRole: ProjectRole,
): boolean {
	return PROJECT_ROLE_RANK[userRole] >= PROJECT_ROLE_RANK[requiredRole];
}

/**
 * Get all roles that are equal or higher than the given role.
 * Useful for select dropdowns showing allowed roles.
 */
export function getEqualOrHigherProjectRoles(role: ProjectRole): ProjectRole[] {
	const rank = PROJECT_ROLE_RANK[role];
	return Object.entries(PROJECT_ROLE_RANK)
		.filter(([, r]) => r >= rank)
		.map(([key]) => key as ProjectRole);
}

/**
 * Get all roles that are lower than the given role.
 */
export function getLowerProjectRoles(role: ProjectRole): ProjectRole[] {
	const rank = PROJECT_ROLE_RANK[role];
	return Object.entries(PROJECT_ROLE_RANK)
		.filter(([, r]) => r < rank)
		.map(([key]) => key as ProjectRole);
}
