import { type LucideIcon } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getOrgId, getProjectId} from "@/api/client"
import {
	SidebarGroup,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/sidebar/sidebar";

export function NavProjects({
	projects,
}: {
	projects: {
		title: string;
		url: string;
		icon?: LucideIcon;
		activePrefix?: string;
	}[];
}) {
	const location = useLocation();
	const pathname = location.pathname;
	const orgId = getOrgId();
	const projectId = getProjectId();	

	// If orgId or projectId is not available, don't try to navigate
	if (!orgId || !projectId) {
		return null;
	}

	return (
		<SidebarGroup className="p-0">
			<SidebarMenu>
				{projects.map((item) => {
					// Check if the URL is external
					const isExternal =
						item.url.startsWith("http://") ||
						item.url.startsWith("https://") ||
						item.url.includes("www.");

					const fullUrl = isExternal ? item.url : `/${orgId}/${projectId}${item.url}`;

					const activeUrl = item.activePrefix
					? `/${orgId}/${projectId}${item.activePrefix}`
					: fullUrl;
				const isActive = !isExternal && pathname.startsWith(activeUrl);

					return (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
								{isExternal ? (
									<a
										href={fullUrl}
										target="_blank"
										className="dark:text-sidebar-foreground"
										rel="noopener noreferrer"
									>
										{item.icon && <item.icon />}
										<span className="group-data-[collapsible=icon]:hidden">
											{item.title}
										</span>
									</a>
								) : (
									<Link to={fullUrl} className="dark:text-sidebar-foreground">
										{item.icon && <item.icon />}
										<span className="group-data-[collapsible=icon]:hidden">
											{item.title}
										</span>
									</Link>
								)}
							</SidebarMenuButton>
						</SidebarMenuItem>
					);
				})}
			</SidebarMenu>
		</SidebarGroup>
	);
}
