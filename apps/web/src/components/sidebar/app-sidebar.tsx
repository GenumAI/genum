import * as React from "react";
import { Folder, GalleryVerticalEnd, File } from "lucide-react";
import { useNavigate, useLocation, useParams } from "react-router-dom";

import { NavMain } from "@/components/sidebar/nav-main";
import { NavProjects } from "@/components/sidebar/nav-projects";
import { NavUser } from "@/components/sidebar/nav-user";
import { NavBottom } from "@/components/sidebar/nav-bottom";
import { SidebarNotificationButton } from "@/components/sidebar/sidebar-notification-button";
import { TeamSwitcher } from "@/components/switchers/workspace-switcher";
import { SocialIcons } from "@/components/ui/icons-tsx/social-icons";

import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarSeparator,
	SidebarTrigger,
} from "@/components/sidebar/sidebar";

import { navigation } from "@/hooks/useNavigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useEffect } from "react";
import { getOrgId, getProjectId } from "@/api/client";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
	const navigate = useNavigate();
	const location = useLocation();
	const params = useParams<{ orgId: string; projectId: string }>();
	const orgId = params.orgId ?? getOrgId();
	const projectId = params.projectId ?? getProjectId();
	const pathSegments = location.pathname.split("/").filter(Boolean);
	const { user } = useCurrentUser();

	const teams =
		user?.organizations?.map((org) => ({
			id: org.id.toString(),
			name: org.name,
			logo: GalleryVerticalEnd,
			plan: org.role,
		})) || [];

	const selectedOrg = user?.organizations?.find((org) => org.id.toString() === orgId);
	const projects =
		selectedOrg?.projects.map((project) => ({
			id: project.id.toString(),
			name: project.name,
			logo: Folder as React.ComponentType<{ className?: string | undefined }>,
			role: project.role,
		})) || [];

	useEffect(() => {
		// If no orgId in URL and user has organizations, navigate to the first one
		if (!orgId && user?.organizations && user.organizations.length > 0) {
			const firstOrgId = user.organizations[0].id.toString();
			let newPath = `/${firstOrgId}`;

			// If the first org has projects, also set the first project
			if (user.organizations[0].projects.length > 0) {
				const firstProjectId = user.organizations[0].projects[0].id.toString();
				newPath = `/${firstOrgId}/${firstProjectId}/dashboard`;
			}

			navigate(newPath);
		}

		// If orgId exists but no projectId, or projectId doesn't belong to the org
		if (selectedOrg) {
			const projectBelongsToOrg =
				projectId && selectedOrg.projects.some((p) => p.id.toString() === projectId);

			if ((!projectId || !projectBelongsToOrg) && selectedOrg.projects.length > 0) {
				const firstProjectId = selectedOrg.projects[0].id.toString();
				// Get the current path segments after orgId/projectId
				const remainingPath = pathSegments.slice(2).join("/");
				const newPath = `/${orgId}/${firstProjectId}${remainingPath ? `/${remainingPath}` : "/dashboard"}`;
				navigate(newPath);
			}
		}
	}, [orgId, selectedOrg, projectId, user?.organizations, navigate, pathSegments]);

	const handleProjectChange = (projectId: string) => {
		const currentPath = location.pathname;
		const currentSearch = location.search;

		if (currentSearch.includes("testcaseId=")) {
			navigate(`/${orgId}/${projectId}/testcases`);
		} else if (currentPath.includes("/prompt/")) {
			navigate(`/${orgId}/${projectId}/prompts`);
		} else {
			const pathSegments = currentPath.split("/").filter(Boolean);
			const remainingPath = pathSegments.slice(2).join("/");

			if (
				remainingPath &&
				!remainingPath.includes("prompt/") &&
				!remainingPath.includes("testcase/")
			) {
				navigate(`/${orgId}/${projectId}/${remainingPath}`);
			} else {
				navigate(`/${orgId}/${projectId}/dashboard`);
			}
		}
	};

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader className="flex flex-row items-center p-3 h-[54px] border-[#f4f4f5] dark:border-[#27272A]">
				<TeamSwitcher
					teams={teams}
					projects={projects}
					selectedProjectId={projectId}
					onProjectChange={handleProjectChange}
				/>
				<SidebarTrigger className="w-8 h-7" />
			</SidebarHeader>
			<SidebarContent>
				<NavMain items={navigation.main} />
				<SidebarSeparator />
				<NavProjects projects={navigation.projects} />
			</SidebarContent>
			<SidebarFooter>
				{/* <SocialIcons /> */}
				<NavBottom items={navigation.bottom} />
				<NavUser />
			</SidebarFooter>
		</Sidebar>
	);
}
