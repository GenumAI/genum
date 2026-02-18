import * as React from "react";
import { Outlet, NavLink, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAddParamsToUrl } from "@/lib/addParamsToUrl";
import { organizationApi } from "@/api/organization";
import { ORG_MEMBERS_QUERY_KEY } from "./hooks/useOrgMembers";
import { ORG_INVITES_QUERY_KEY } from "./hooks/useOrgInvites";
import { useRefetchOnWorkspaceChange } from "@/hooks/useRefetchOnWorkspaceChange";

type MenuSection = {
	title: string;
	items: { label: string; to: string }[];
};

const MENU: MenuSection[] = [
	{
		title: "User",
		items: [{ label: "Profile", to: "/settings/user/profile" }],
	},
	{
		title: "Organization",
		items: [
			{ label: "Details", to: "/settings/org/details" },
			{ label: "Members", to: "/settings/org/members" },
			{ label: "Projects", to: "/settings/org/projects" },
			{ label: "AI Providers", to: "/settings/org/ai-keys" },
			{ label: "Models", to: "/settings/org/models" },
			{ label: "API", to: "/settings/org/api-keys" },
		],
	},
	{
		title: "Project",
		items: [
			{ label: "Details", to: "/settings/project/details" },
			// { label: "Members", to: "/settings/project/members" },
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
					{MENU.map((section) => (
						<div key={section.title} className="mb-1">
							<h3 className="leading-[36px] mb-1 text-sm font-medium text-[#18181B] dark:text-[#FAFAFA]">
								{section.title}
							</h3>
							{section.items.map((item) => (
								<NavItem key={item.to} to={item.to}>
									{item.label}
								</NavItem>
							))}
						</div>
					))}
				</aside>

				<main className="flex-1">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
