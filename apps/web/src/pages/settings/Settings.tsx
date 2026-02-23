import * as React from "react";
import { Outlet, NavLink, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAddParamsToUrl } from "@/lib/addParamsToUrl";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { organizationApi } from "@/api/organization";
import { ORG_MEMBERS_QUERY_KEY } from "./hooks/useOrgMembers";
import { ORG_INVITES_QUERY_KEY } from "./hooks/useOrgInvites";
import { useRefetchOnWorkspaceChange } from "@/hooks/useRefetchOnWorkspaceChange";

type OrgRole = "OWNER" | "ADMIN" | "READER";

type MenuItem = {
	label: string;
	to: string;
	minRole?: OrgRole;
};

type MenuSection = {
	title: string;
	items: MenuItem[];
};

const ORG_ROLE_RANK: Record<OrgRole, number> = {
	READER: 0,
	ADMIN: 1,
	OWNER: 2,
};

function hasAccess(itemRole: OrgRole | undefined, userRole: OrgRole): boolean {
	if (!itemRole) return true;
	return ORG_ROLE_RANK[userRole] >= ORG_ROLE_RANK[itemRole];
}

const MENU: MenuSection[] = [
	{
		title: "User",
		items: [{ label: "Profile", to: "/settings/user/profile" }],
	},
	{
		title: "Organization",
		items: [
			{ label: "Details", to: "/settings/org/details" },
			{ label: "Members", to: "/settings/org/members", minRole: "ADMIN" },
			{ label: "Projects", to: "/settings/org/projects", minRole: "ADMIN" },
			{ label: "AI Providers", to: "/settings/org/ai-keys", minRole: "ADMIN" },
			{ label: "Models", to: "/settings/org/models", minRole: "ADMIN" },
			{ label: "API", to: "/settings/org/api-keys", minRole: "ADMIN" },
		],
	},
	{
		title: "Project",
		items: [
			{ label: "Details", to: "/settings/project/details" },
			{ label: "Members", to: "/settings/project/members" },
			{ label: "API", to: "/settings/project/api-keys" },
		],
	},
];

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
	const addParamsToUrl = useAddParamsToUrl();

	return (
		<NavLink
			to={addParamsToUrl(to)}
			end
			className={({ isActive }) =>
				cn(
					"block rounded-md px-2 py-[9px] h-[32px] text-sm dark:text-[#F4F4F5] hover:dark:text-[#a3a3a3] font-normal transition-colors leading-[1]",
					isActive
						? "bg-muted dark:text-[#F4F4F5] font-medium"
						: "hover:bg-muted text-muted-foreground",
				)
			}
		>
			{children}
		</NavLink>
	);
}

export default function Settings() {
	const { orgId } = useParams<{ orgId: string }>();
	const queryClient = useQueryClient();
	const { user } = useCurrentUser();

	const currentOrg = user?.organizations?.find((o) => o.id.toString() === orgId);
	const orgRole = (currentOrg?.role ?? "READER") as OrgRole;

	// Prefetch org members & invites so switching to Members tab uses cache (no refetch)
	React.useEffect(() => {
		if (orgId) {
			queryClient.prefetchQuery({
				queryKey: [...ORG_MEMBERS_QUERY_KEY, orgId],
				queryFn: () => organizationApi.getMembers(),
			});
			queryClient.prefetchQuery({
				queryKey: [...ORG_INVITES_QUERY_KEY, orgId],
				queryFn: () => organizationApi.getInvites(),
			});
		}
	}, [queryClient, orgId]);

	useRefetchOnWorkspaceChange(() => {
		queryClient.invalidateQueries();
	});

	return (
		<div className="container pt-6 max-w-[1232px] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px] 2xl-plus:w-[70%] mx-3 w-full">
			<div className="flex flex-col gap-6 md:flex-row mt-3">
				<aside className="shrink-0 w-[216px]">
				{MENU.map((section) => {
						const visibleItems = section.items.filter((item) =>
							hasAccess(item.minRole, orgRole),
						);
						if (visibleItems.length === 0) return null;
						return (
							<div key={section.title} className="mb-1">
								<h3 className="leading-[36px] mb-1 text-sm font-medium text-[#18181B] dark:text-[#FAFAFA]">
									{section.title}
								</h3>
								{visibleItems.map((item) => (
									<NavItem key={item.to} to={item.to}>
										{item.label}
									</NavItem>
								))}
							</div>
						);
					})}
				</aside>

				<main className="flex-1">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
