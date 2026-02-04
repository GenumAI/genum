import { useAuth } from "@/hooks/useAuth";
import { isCloudAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/stores/user.store";

import { BadgeCheck, Bell, ChevronsUpDown, CreditCard, LogOut, Sparkles } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
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

export function NavUser() {
	const { isMobile } = useSidebar();
	const { logout, user: authUser } = useAuth();
	const user = useUserStore((state) => state.user);
	const navigate = useNavigate();
	const isCloud = isCloudAuth();
	const clearUser = useUserStore((state) => state.clearUser);

	const LETTER_COLOR_MAP: Record<string, string> = {
		A: "bg-[#D6CFFF]",
		B: "bg-[#BBCAFF]",
		C: "bg-[#BFDEFF]",
		D: "bg-[#D5F0FF]",
		E: "bg-[#D7EFEB]",
		F: "bg-[#D6F6E6]",
		G: "bg-[#DEEADE]",
		H: "bg-[#E7F5C8]",
		I: "bg-[#FFE4F2]",
		J: "bg-[#FFD7D8]",
		K: "bg-[#FFE6B1]",
		L: "bg-[#F9ECDB]",
		M: "bg-[#D6CFFF]",
		N: "bg-[#BBCAFF]",
		O: "bg-[#BFDEFF]",
		P: "bg-[#D5F0FF]",
		Q: "bg-[#D7EFEB]",
		R: "bg-[#D6F6E6]",
		S: "bg-[#DEEADE]",
		T: "bg-[#E7F5C8]",
		U: "bg-[#FFE4F2]",
		V: "bg-[#FFD7D8]",
		W: "bg-[#FFE6B1]",
		X: "bg-[#F9ECDB]",
		Y: "bg-[#D6CFFF]",
		Z: "bg-[#BBCAFF]",
	};

	const getColorByFirstLetter = (name: string): string => {
		const firstLetter = name[0]?.toUpperCase() || "";
		return LETTER_COLOR_MAP[firstLetter] || "bg-[#D6CFFF]";
	};

	const isLetter = (char: string): boolean => /^[a-zA-Z]$/.test(char);

	const userName = user?.name || authUser?.name || "User";
	const userEmail = user?.email || authUser?.email || "";
	const userAvatar = user?.avatar || authUser?.picture;

	const firstChar = userName[0] ?? "";
	const isNonLetter = !firstChar || !isLetter(firstChar);
	const authorInitial = isNonLetter ? "G" : firstChar.toUpperCase();
	const authorColor = isNonLetter ? "bg-black text-white" : getColorByFirstLetter(userName);

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="data-[state=open]:bg-sidebar-accent h-10 data-[state=open]:text-sidebar-accent-foreground p-1 group-data-[collapsible=icon]:!p-1 group-data-[collapsible=icon]:!h-10"
						>
							<Avatar className="h-8 w-8 rounded-lg">
								<AvatarImage
									src={userAvatar ?? "/assets/avatars/shadcn.jpg"}
									alt={userName}
								/>
								<AvatarFallback
									className={`rounded-lg font-bold text-[18px] ${authorColor}`}
								>
									{authorInitial}
								</AvatarFallback>
							</Avatar>
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
								<Avatar className="h-8 w-8 rounded-lg">
									<AvatarImage
										src={userAvatar ?? "/assets/avatars/shadcn.jpg"}
										alt={userName}
									/>
									<AvatarFallback
										className={`rounded-lg bg-[#83ABFF80] ${authorColor}`}
									>
										{authorInitial}
									</AvatarFallback>
								</Avatar>
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
									clearUser();
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
