import { type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/sidebar/sidebar";
import { SidebarNotificationButton } from "@/components/sidebar/sidebar-notification-button";
import { SidebarFeedbackButton } from "@/components/sidebar/feedback/sidebar-feedback-button";

interface BottomItem {
	title: string;
	url: string;
	icon: LucideIcon;
	external?: boolean;
	customComponent?: string;
}

const customComponents: Record<string, React.ComponentType> = {
	SidebarNotificationButton,
	SidebarFeedbackButton,
};

export function NavBottom({ items }: { items: BottomItem[] }) {
	return (
		<SidebarGroup className="p-0">
			<SidebarGroupContent className="flex flex-col gap-2">
				<SidebarMenu>
					{items.map((item) => {
						// If item has a custom component, render it instead
						if (item.customComponent && customComponents[item.customComponent]) {
							const CustomComponent = customComponents[item.customComponent];
							return (
								<SidebarMenuItem key={item.title}>
									<CustomComponent />
								</SidebarMenuItem>
							);
						}

						if (item.external) {
							return (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton asChild tooltip={item.title}>
										<a
											href={item.url}
											target="_blank"
											rel="noreferrer"
											className="font-normal"
										>
											<item.icon />
											<span className="group-data-[collapsible=icon]:hidden">
												{item.title}
											</span>
										</a>
									</SidebarMenuButton>
								</SidebarMenuItem>
							);
						}

						return (
							<SidebarMenuItem key={item.title}>
								<SidebarMenuButton asChild tooltip={item.title}>
									<Link to={item.url} className="font-normal">
										<item.icon />
										<span className="group-data-[collapsible=icon]:hidden">
											{item.title}
										</span>
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
