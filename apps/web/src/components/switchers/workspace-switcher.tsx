import { SidebarMenu, SidebarMenuItem } from "@/components/sidebar/sidebar";
import { OrganizationSwitcher } from "@/components/switchers/organization-switcher";
import { getOrgId, getProjectId } from "@/api/client";

type Project = {
	id: string;
	name: string;
	logo: React.ComponentType<{
		className?: string | undefined;
	}>;
	role: string;
};

export function TeamSwitcher({
	teams,
	projects,
	selectedProjectId,
	onProjectChange,
}: {
	teams: {
		id?: string;
		name: string;
		logo: React.ElementType;
		plan?: string;
	}[];
	projects?: Project[];
	selectedProjectId?: string | null;
	onProjectChange?: (projectId: string) => void;
}) {
	const orgId = getOrgId();
	const projectId = getProjectId();

	return (
		<SidebarMenu className="group-data-[collapsible=icon]:hidden">
			<SidebarMenuItem>
				<OrganizationSwitcher
					organizations={teams}
					projects={projects}
					orgId={orgId}
					projectId={projectId}
					selectedProjectId={selectedProjectId}
					onProjectChange={onProjectChange}
				/>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
