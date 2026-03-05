import { OrganizationRole } from "./organization.api";

/**
 * Role rank mapping for organization roles.
 * Higher number = more permissions.
 */
export const ORG_ROLE_RANK: Record<OrganizationRole, number> = {
	[OrganizationRole.READER]: 0,
	[OrganizationRole.ADMIN]: 1,
	[OrganizationRole.OWNER]: 2,
};

/**
 * Check if user has required organization role level.
 * @param userRole - The user's current role in the organization
 * @param requiredRole - The minimum role required
 * @returns true if user has access
 */
export function hasOrgAccess(
	userRole: OrganizationRole,
	requiredRole: OrganizationRole,
): boolean {
	return ORG_ROLE_RANK[userRole] >= ORG_ROLE_RANK[requiredRole];
}

/**
 * Get all roles that are equal or higher than the given role.
 * Useful for select dropdowns showing allowed roles.
 */
export function getEqualOrHigherOrgRoles(role: OrganizationRole): OrganizationRole[] {
	const rank = ORG_ROLE_RANK[role];
	return Object.entries(ORG_ROLE_RANK)
		.filter(([, r]) => r >= rank)
		.map(([key]) => key as OrganizationRole);
}

/**
 * Get all roles that are lower than the given role.
 * Useful for invites (e.g., OWNER can invite ADMIN or READER, but not another OWNER).
 */
export function getLowerOrgRoles(role: OrganizationRole): OrganizationRole[] {
	const rank = ORG_ROLE_RANK[role];
	return Object.entries(ORG_ROLE_RANK)
		.filter(([, r]) => r < rank)
		.map(([key]) => key as OrganizationRole);
}
