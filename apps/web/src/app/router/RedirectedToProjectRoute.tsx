import { useEffect } from "react";
import type { UserType } from "@/types/User";
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { setApiContext, clearApiContext } from "@/api/client";

/**
 * This component is the "entry point" for the authenticated part of the app.
 *
 * Responsibilities:
 * - **Initialize API context** (token + orgId/projectId) for `apiClient` interceptors.
 * - **Load the current user** via react-query (useCurrentUser).
 * - **Normalize the URL**: if orgId/projectId are missing or invalid, pick a default
 *   workspace (org/project) and redirect.
 *
 * Why it matters here:
 * - The router wraps all "app" pages with `ProtectedRoute -> RedirectedToProjectRoute -> MainLayout`.
 * - While user data isn't loaded, we don't render the layout/pages to prevent them from firing
 *   API requests without context and without user data.
 */
interface RedirectedToProjectRouteProps {
	Element: React.ComponentType<{ user: UserType }>;
}

const GENUMLAB_LAST_ORG_ID = "genumlab_last_org_id";
const GENUMLAB_LAST_PROJECT_ID = "genumlab_last_project_id";

const RedirectedToProjectRoute = ({ Element }: RedirectedToProjectRouteProps) => {
	const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
	const { isAuthenticated, isLoading: isLoadingAuth, getAccessTokenSilently } = useAuth();
	const { user: userData, isLoading } = useCurrentUser();

	// Set API context synchronously so getOrgId/getProjectId are available to children (e.g. AppSidebar) on first render
	setApiContext({
		getToken: async () => {
			try {
				return await getAccessTokenSilently();
			} catch {
				return "";
			}
		},
		getOrgId: () => orgId,
		getProjectId: () => projectId,
	});

	// Clear context on unmount
	useEffect(() => () => clearApiContext(), []);

	// Gate: while auth/user data isn't ready, show a simple placeholder
	if (!isAuthenticated || isLoadingAuth || isLoading || !userData) {
		return (
			<div className="flex h-screen w-full items-center justify-center">
				<div className="flex flex-col items-center space-y-4">
					<div className="h-8 w-8 animate-spin text-gray-500 dark:text-gray-400" />
					<p className="text-gray-500 dark:text-gray-400">Loading...</p>
				</div>
			</div>
		);
	}

	// Basic validation: email is required
	if (!userData.email) {
		console.error("[RedirectedToProjectRoute] Invalid user data structure:", userData);
		return null;
	}

	const getDefaultSpace = () => {
		if (!userData.organizations || userData.organizations.length === 0) {
			return null;
		}

		let orgWithProjects = userData.organizations.find(
			(org) => org.role === "OWNER" && org.projects && org.projects.length > 0,
		);

		if (!orgWithProjects) {
			orgWithProjects = userData.organizations.find(
				(org) => org.projects && org.projects.length > 0,
			);
		}

		if (!orgWithProjects) {
			return null;
		}

		const project = orgWithProjects.projects[0];
		return { org: orgWithProjects, project };
	};

	// If the URL doesn't include orgId/projectId, try restoring the last workspace from localStorage.
	if (!orgId && !projectId) {
		const lastOrgId = localStorage.getItem(GENUMLAB_LAST_ORG_ID);
		const lastProjectId = localStorage.getItem(GENUMLAB_LAST_PROJECT_ID);

		if (lastOrgId && lastProjectId) {
			const matchingOrg = userData.organizations.find(
				(org) => org.id.toString() === lastOrgId,
			);
			if (matchingOrg) {
				const matchingProject = matchingOrg.projects.find(
					(project) => project.id.toString() === lastProjectId,
				);
				if (matchingProject) {
					return (
						<Navigate to={`/${lastOrgId}/${lastProjectId}/getting-started`} replace />
					);
				}
			}
		}
	}

	const defaultSpace = getDefaultSpace();
	if (!defaultSpace) {
		return (
			<div className="flex h-screen w-full items-center justify-center">
				<div className="flex flex-col items-center space-y-4">
					<p className="text-red-500">No organizations or projects found</p>
				</div>
			</div>
		);
	}

	if (orgId && projectId) {
		const matchingOrg = userData.organizations.find((org) => org.id.toString() === orgId);

		if (matchingOrg) {
			const matchingProject = matchingOrg.projects.find(
				(project) => project.id.toString() === projectId,
			);

			if (matchingProject) {
				return <Element user={userData} />;
			}
		}

		return (
			<Navigate
				to={`/${defaultSpace.org.id}/${defaultSpace.project.id}/getting-started`}
				replace
			/>
		);
	}

	if (orgId && !projectId) {
		const matchingOrg = userData.organizations.find((org) => org.id.toString() === orgId);

		if (matchingOrg && matchingOrg.projects.length > 0) {
			const project = matchingOrg.projects[0];
			return <Navigate to={`/${matchingOrg.id}/${project.id}/getting-started`} replace />;
		}

		return (
			<Navigate
				to={`/${defaultSpace.org.id}/${defaultSpace.project.id}/getting-started`}
				replace
			/>
		);
	}

	return (
		<Navigate
			to={`/${defaultSpace.org.id}/${defaultSpace.project.id}/getting-started`}
			replace
		/>
	);
};

export default RedirectedToProjectRoute;
