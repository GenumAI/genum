import { useParams } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { ProjectRole } from "@/api/project";

/**
 * The current user's role in the project taken from the URL.
 *
 * Read from the cached /user/me payload -- which already carries the caller's
 * own role for every project they belong to -- rather than from the project
 * members list, so gating a control costs no extra request. This mirrors how
 * RoleProtectedRoute resolves the organization role.
 *
 * `role` is null while the user is still loading, and for a project the user
 * is not a member of.
 */
export function useCurrentProjectRole(): { role: ProjectRole | null; isLoading: boolean } {
	const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
	const { user, isLoading } = useCurrentUser();

	const org = user?.organizations?.find((o) => o.id.toString() === orgId);
	const project = org?.projects?.find((p) => p.id.toString() === projectId);

	return { role: project?.role ?? null, isLoading };
}
