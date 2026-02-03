import { type LucideIcon } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuBadge,
} from "@/components/sidebar/sidebar";
import { getOrgId, getProjectId } from "@/api/client";

export function NavMain({
	items,
}: {
	items: {
		title: string;
		url: string;
		icon?: LucideIcon;
		beta?: boolean;
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
			<SidebarGroupContent className="flex flex-col gap-2">
				<SidebarMenu>
					{items.map((item) => {
						const fullUrl = `/${orgId}/${projectId}${item.url}`;
						const isActive = pathname.startsWith(fullUrl);
						return (
							<SidebarMenuItem key={item.title}>
								<SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
									<Link to={fullUrl} className="dark:text-sidebar-foreground">
										{item.icon && <item.icon />}
										<span className="group-data-[collapsible=icon]:hidden">
											{item.title}
										</span>
										{item.beta && (
											<span className="ml-1 bg-blue-100 text-blue-700 text-xs font-medium px-1.5 py-0.5 rounded group-data-[collapsible=icon]:hidden">
												Beta
											</span>
										)}
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
						);
					})}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}
