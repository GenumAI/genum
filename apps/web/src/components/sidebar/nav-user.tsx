import { useAuth } from "@/hooks/useAuth";
import { isCloudAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQueryClient } from "@tanstack/react-query";

import { LogOut } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CommitAuthorAvatar } from "@/pages/prompt/utils/CommitAuthorAvatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/sidebar/sidebar";
import { getAvatarColor, getAvatarInitial } from "@/lib/avatarUtils";

export function NavUser() {
	const { isMobile } = useSidebar();
	const { logout, user: authUser } = useAuth();
	const { user } = useCurrentUser();
	const navigate = useNavigate();
	const isCloud = isCloudAuth();
	const queryClient = useQueryClient();

	const userName = user?.name || authUser?.name || "User";
	const userEmail = user?.email || authUser?.email || "";
	const userAvatar = isCloud
		? user?.avatar || user?.picture
		: authUser?.picture || user?.avatar || user?.picture;
	const authorInitial = getAvatarInitial(userName);
	const authorColor = getAvatarColor(userName);
	const localNavAuthor = {
		name: userName,
		picture: authUser?.picture || user?.avatar || user?.picture || null,
	};

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="data-[state=open]:bg-sidebar-accent h-10 data-[state=open]:text-sidebar-accent-foreground p-1 group-data-[collapsible=icon]:!p-1 group-data-[collapsible=icon]:!h-10"
						>
							{isCloud ? (
								<Avatar className="h-8 w-8 rounded-lg">
									<AvatarImage
										src={userAvatar}
										alt={userName}
									/>
									<AvatarFallback
										className={`rounded-lg font-bold text-[18px] ${authorColor}`}
									>
										{authorInitial}
									</AvatarFallback>
								</Avatar>
							) : (
								<CommitAuthorAvatar
									author={localNavAuthor}
									size="h-8 w-8"
									rounded="rounded-lg"
									textSize="text-[18px]"
								/>
							)}
							<div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
								<span className="truncate font-semibold">{userName}</span>
								<span className="truncate text-xs">{userEmail}</span>
							</div>
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
						side={isMobile ? "bottom" : "right"}
						align="end"
						sideOffset={4}
					>
						<DropdownMenuLabel className="p-0 font-normal">
							<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
								{isCloud ? (
									<Avatar className="h-8 w-8 rounded-lg">
										<AvatarImage
											src={userAvatar}
											alt={userName}
										/>
										<AvatarFallback
											className={`rounded-lg bg-brand/50 ${authorColor}`}
										>
											{authorInitial}
										</AvatarFallback>
									</Avatar>
								) : (
									<CommitAuthorAvatar
										author={localNavAuthor}
										size="h-8 w-8"
										rounded="rounded-lg"
										textSize="text-sm"
									/>
								)}
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">{userName}</span>
									<span className="truncate text-xs">{userEmail}</span>
								</div>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={async () => {
								if (isCloud) {
									// Auth0 logout
									logout({ logoutParams: { returnTo: window.location.origin } });
								} else {
									// Local auth logout
									await logout();
									queryClient.clear();
									navigate("/login");
								}
							}}
						>
							<LogOut />
							Log out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
