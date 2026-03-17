import { useEffect, useState } from "react";
import {
	Outlet,
	useLocation,
	useParams,
	useSearchParams,
	ScrollRestoration,
} from "react-router-dom";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/sidebar/sidebar";
import PageHeader from "@/components/layout/header/page-header";
import { MainLayoutBreadcrumb } from "@/components/layout/header/MainLayoutBreadcrumb";

import { navigation } from "@/hooks/useNavigation";
import { usePromptById } from "@/hooks/usePrompt";
import { useNotificationById } from "@/hooks/useNotificationById";
import { promptApi } from "@/api/prompt";
import type { UserType } from "@/types/User";
import { CookiesPopover } from "@/components/popovers/CookiesPopover";
import { useDeviceOrientation } from "@/hooks/useDeviceOrientation";
import Phone from "@/assets/phone.svg";
import Rotate from "@/assets/rotate.svg";
import Logo from "@/assets/logo.svg";
import clsx from "clsx";
import VersionStatus from "@/pages/prompt/playground-tabs/version/components/VersionStatus";
import { PromptStatusProvider, usePromptStatus } from "@/contexts/PromptStatusContext";
import PendingInviteHandler from "@/pages/invite/PendingInviteHandler";
import { useQuery } from "@tanstack/react-query";
import { testcaseKeys } from "@/query-keys/testcases.keys";
import { testcasesApi } from "@/api/testcases";

const GENUMLAB_LAST_ORG_ID = "genumlab_last_org_id";
const GENUMLAB_LAST_PROJECT_ID = "genumlab_last_project_id";

function LayoutContent({ user }: { user: UserType }) {
	const location = useLocation();
	const [searchParams] = useSearchParams();
	const { orgId, projectId, id, versionId, notificationId } = useParams<{
		orgId: string;
		projectId: string;
		id: string;
		versionId: string;
		notificationId: string;
	}>();
	const testcaseId = searchParams.get("testcaseId");

	useEffect(() => {
		if (orgId) {
			localStorage.setItem(GENUMLAB_LAST_ORG_ID, orgId);
		}
		if (projectId) {
			localStorage.setItem(GENUMLAB_LAST_PROJECT_ID, projectId);
		}
	}, [orgId, projectId]);

	const promptId = id ? Number(id) : undefined;
	const { prompt } = usePromptById(promptId);
	const { notification: notificationData } = useNotificationById(notificationId);
	const isPlayground = window.location.pathname.endsWith("/playground");

	const { isCommitted, setIsCommitted, activePromptId } = usePromptStatus();
	const { data: testcaseData } = useQuery({
		queryKey: testcaseKeys.byId(testcaseId ?? undefined),
		queryFn: async () => {
			if (!testcaseId) throw new Error("Testcase ID is required");
			return testcasesApi.getTestcase(testcaseId);
		},
		enabled: false,
		retry: false,
	});
	const testcase = testcaseData?.testcase ?? null;

	const isVersionsPage = /^\/[^/]+\/[^/]+\/prompt\/\d+\/versions\/\d+\/?$/.test(
		location.pathname,
	);
	const [version, setVersion] = useState<any>(null);
	const [isRefetching, setIsRefetching] = useState(false);

	useEffect(() => {
		if (isVersionsPage && id && versionId) {
			setIsRefetching(true);
			promptApi
				.getVersion(id, versionId)
				.then((data) => {
					setVersion(data);
				})
				.catch((error) => {
					console.error("Failed to fetch version:", error);
				})
				.finally(() => {
					setIsRefetching(false);
				});
		} else {
			setVersion(null);
		}
	}, [isVersionsPage, id, versionId]);

	const pathnames = location.pathname.split("/").filter(Boolean);
	const currentSubPath = pathnames.length > 4 ? pathnames[4] : "";
	const allNavItems = [
		...navigation.main,
		...navigation.projects,
		...navigation.help,
		...navigation.notifications,
	];
	const activeMainItem = allNavItems.find((item) => {
		const pathWithoutOrgProject = "/" + pathnames.slice(2).join("/");
		return pathWithoutOrgProject.startsWith(item.url);
	});

	const pageTitle = promptId && prompt?.prompt?.name ? prompt.prompt.name : activeMainItem?.title || "Undefined Prompt";
	const displayPromptName = prompt?.prompt?.name;

	const routeItems = [
		{ label: "Playground", path: "playground" },
		{ label: "Testcases", path: "testcases" },
		{ label: "Versions", path: "versions" },
		{ label: "Memory", path: "memory" },
		{ label: "Logs", path: "logs" },
		{ label: "API", path: "api" },
	].map((item) => {
		const baseHref = `/prompt/${id}/${item.path}`;
		const href = testcaseId ? `${baseHref}?testcaseId=${testcaseId}` : baseHref;

		return {
			...item,
			href,
			active: item.path === currentSubPath,
		};
	});

	const isPromptPage = promptId && prompt?.prompt;

	const handleCommitStatusChange = (newCommited: boolean) => {
		setIsCommitted(newCommited);
	};

	return (
		<>
			<ScrollRestoration />
			<PendingInviteHandler />
			<RotateScreenPlug />
			<CookiesPopover />
			<AppSidebar />
			<SidebarInset>
				<header className="w-full bg-background dark:bg-sidebar z-[49] top-0 flex h-[54px] border-b border-[#E4E4E7] dark:border-[#27272A] shrink-0 items-center gap-2 transition-[width,height] ease-linear sticky">
					<div className="flex items-center gap-2 pl-5 pr-6 w-full justify-between">
						<MainLayoutBreadcrumb
							pathnames={pathnames}
							orgId={orgId}
							projectId={projectId}
							promptId={id}
							promptName={displayPromptName}
							versionId={versionId}
							versionCommitMessage={version?.version?.commitMsg}
							isRefetchingVersion={isRefetching}
							notificationId={notificationId}
							notificationTitle={notificationData?.title}
							testcaseId={testcaseId}
							testcaseName={testcase?.name}
						/>
						{isPromptPage && isPlayground && activePromptId === promptId && (
							<VersionStatus
								promptId={promptId}
								commited={isCommitted}
								promptCommit={prompt?.prompt?.lastCommit?.commitHash ?? ""}
								onCommitStatusUpdate={() => {}}
								onCommitStatusChange={handleCommitStatusChange}
							/>
						)}
					</div>
				</header>
				<PageHeader title={pageTitle} navItems={routeItems} />
				<main className="bg-white dark:bg-background h-full mainContent w-full flex justify-center pb-8 [&>*]:w-full [&>*]:min-w-0">
					<Outlet />
				</main>
			</SidebarInset>
		</>
	);
}

export default function MainLayout({ user }: { user: UserType }) {
	return (
		<PromptStatusProvider>
			<SidebarProvider>
				<LayoutContent user={user} />
			</SidebarProvider>
		</PromptStatusProvider>
	);
}

const RotateScreenPlug = () => {
	const { orientation, isMobile } = useDeviceOrientation();
	const { setOpen } = useSidebar();

	useEffect(() => {
		const main = document.querySelector("main.mainContent") as HTMLDivElement;
		if (isMobile && orientation === "portrait") {
			if (main) main.style.overflow = "hidden";
		} else {
			if (main) main.style.overflow = "auto";
		}
		if (orientation === "landscape" && isMobile) {
			setTimeout(() => setOpen(false), 0);
			forceRepaint();
		}
	}, [orientation, isMobile]);

	if (orientation === "portrait" && isMobile) {
		return (
			<div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center w-full min-h-[100dvh] h-full">
				<div
					style={{ backgroundImage: 'url("/rotation-bg.png")' }}
					className={clsx(
						"absolute inset-0 bg-center bg-no-repeat bg-cover scale-x-[-1] scale-y-[-1]",
						"before:content-[''] before:absolute before:inset-0 before:backdrop-blur-[45px]",
					)}
				/>
				<div className="absolute inset-0 bg-[#f2f2f2] opacity-50" />
				<div className="absolute top-0 z-10 mt-6">
					<Logo />
				</div>
				<div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-[12px] font-bold leading-[1.2]">
					<div className="absolute w-[104px] px-2 text-justify">
						<Rotate />
					</div>
					<div className="animate-spin90 top-[50%] left-[50%]">
						<div className="origin-center">
							<Phone className="scale-[120%]" />
						</div>
					</div>
				</div>
			</div>
		);
	}

	return null;
};

function forceRepaint() {
	window.scrollTo(0, 1);
	setTimeout(() => {
		window.scrollTo(0, 0);
	}, 50);
}
