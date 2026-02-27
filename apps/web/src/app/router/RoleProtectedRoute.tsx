import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { OrganizationRole, ORG_ROLE_RANK } from "@/api/organization";

interface RoleProtectedRouteProps {
	children: React.ReactNode;
	minRole?: OrganizationRole;
}

export default function RoleProtectedRoute({
	children,
	minRole = OrganizationRole.READER,
}: RoleProtectedRouteProps) {
	const navigate = useNavigate();
	const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
	const { user, isLoading } = useCurrentUser();

	const currentOrg = user?.organizations?.find((o) => o.id.toString() === orgId);
	const userRole = currentOrg?.role ?? OrganizationRole.READER;
	const hasAccess = ORG_ROLE_RANK[userRole] >= ORG_ROLE_RANK[minRole];

	useEffect(() => {
		if (!isLoading && !hasAccess) {
			// Redirect to user profile if user doesn't have required role
			// Preserve orgId and projectId in the URL
			const basePath = orgId && projectId ? `/${orgId}/${projectId}` : "";
			navigate(`${basePath}/settings/user/profile`, { replace: true });
		}
	}, [isLoading, hasAccess, navigate, orgId, projectId]);

	if (isLoading) return null;

	if (!hasAccess) {
		return null;
	}

	return <>{children}</>;
}
