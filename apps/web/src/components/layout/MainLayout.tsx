import { useEffect, useState } from "react";
import {
	Outlet,
	useLocation,
	useParams,
	Link,
	useSearchParams,
	ScrollRestoration,
} from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/sidebar/sidebar";
import PageHeader from "@/components/layout/header/page-header";

import { navigation } from "@/hooks/useNavigation";
import { usePromptById } from "@/hooks/usePrompt";
import { testcasesApi } from "@/api/testcases/testcases.api";
import { useNotificationById } from "@/hooks/useNotificationById";
import { promptApi } from "@/api/prompt";
import type { TestCaseResponse } from "@/types/TestСase";
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

const GENUMLAB_LAST_ORG_ID = "genumlab_last_org_id";
const GENUMLAB_LAST_PROJECT_ID = "genumlab_last_project_id";

function LayoutContent({ user }: { user: UserType }) {
	const location = useLocation();
	const [searchParams] = useSearchParams();
	const queryClient = useQueryClient();
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
	const [promptName, setPromptName] = useState<string | null>(null);
	const isPlayground = window.location.pathname.endsWith("/playground");

	const { isCommitted, setIsCommitted, activePromptId } = usePromptStatus();
	const [testcase, setTestcase] = useState<TestCaseResponse["testcase"] | null>(null);

	useEffect(() => {
		if (testcaseId) {
			const fetchTestcase = () => {
				testcasesApi
					.getTestcase(testcaseId)
					.then((response) => {
						setTestcase(response.testcase);
					})
					.catch((error) => {
						console.error("Failed to fetch testcase:", error);
						setTestcase(null);
					});
			};

			fetchTestcase();

			const handleTestcaseUpdated = () => {
				fetchTestcase();
			};

			window.addEventListener("testcaseUpdated", handleTestcaseUpdated);

			return () => {
				window.removeEventListener("testcaseUpdated", handleTestcaseUpdated);
			};
		} else {
			setTestcase(null);
		}
	}, [testcaseId]);

	useEffect(() => {
		const handlePromptNameChange = (event: CustomEvent) => {
			if (event.detail.promptId === promptId) {
				setPromptName(event.detail.newName);
			}
		};

		window.addEventListener("promptNameChanged", handlePromptNameChange as EventListener);

		return () => {
			window.removeEventListener(
				"promptNameChanged",
				handlePromptNameChange as EventListener,
			);
		};
	}, [promptId]);

	useEffect(() => {
		setPromptName(null);
	}, [promptId]);

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

	const displayPromptName = promptName || prompt?.prompt?.name;
	const pageTitle =
		promptId && displayPromptName ? displayPromptName : activeMainItem?.title || "Dashboard";

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

	const breadcrumbMap: Record<string, { label: string; path?: string }> = {
		prompt: { label: "Prompts", path: "prompts" },
		prompts: { label: "Prompts", path: "prompts" },
	};

	const getBreadcrumbHref = (segments: string[], index: number): string => {
		const orgIdSegment = orgId || "";
		const projectIdSegment = projectId || "";

		const actualSegments = segments.slice(0, index + 1).map((segment, segmentIndex) => {
			if (segment === "prompts" && segments[segmentIndex + 1]?.match(/^\d+$/)) {
				return "prompt";
			} else if (segment === "prompts") {
				return "prompts";
			}
			return breadcrumbMap[segment]?.path || segment;
		});

		const href = `/${orgIdSegment}/${projectIdSegment}/` + actualSegments.join("/");

		return href;
	};

	const isPromptPage = promptId && prompt?.prompt;

	const handleCommitStatusChange = (newCommited: boolean) => {
		setIsCommitted(newCommited);

		if (promptId) {
			queryClient.setQueryData(["prompt", promptId], (oldData: any) => {
				if (!oldData) return oldData;
				return {
					...oldData,
					prompt: {
						...oldData.prompt,
						commited: newCommited,
						updatedAt: new Date().toISOString(),
					},
				};
			});
		}
	};

	return (
		<>
			<ScrollRestoration />
			<PendingInviteHandler />
			<RotateScreenPlug />
			<CookiesPopover />
			<AppSidebar user={user} />
			<SidebarInset>
				<header className="w-full bg-background dark:bg-sidebar z-[49] top-0 flex h-[54px] border-b border-[#E4E4E7] dark:border-[#27272A] shrink-0 items-center gap-2 transition-[width,height] ease-linear sticky">
					<div className="flex items-center gap-2 pl-5 pr-6 w-full justify-between">
						<Breadcrumb>
							<BreadcrumbList>
								{pathnames.slice(2).map((segment, index, localArray) => {
									const mapped = breadcrumbMap[segment];
									const isLast = index === localArray.length - 1;

									let label;
									if (segment.toLowerCase() === "api") {
										label = "API";
									} else if (segment.toLowerCase() === "org") {
										label = "Organization";
									} else if (segment.toLowerCase() === "ai-keys") {
										label = "LLM API Keys";
									} else if (segment.toLowerCase() === "api-keys") {
										label = "API Keys";
									} else if (segment === id && displayPromptName) {
										label = displayPromptName;
									} else if (
										version?.version &&
										segment === versionId &&
										!isRefetching
									) {
										label = version.version.commitMsg;
									} else if (
										segment === notificationId &&
										notificationData?.title
									) {
										label = notificationData.title;
									} else {
										label =
											mapped?.label ||
											segment.charAt(0).toUpperCase() + segment.slice(1);
									}

									const truncateLabel = (text: string) => {
										return text.length > 50
											? text.substring(0, 50) + "..."
											: text;
									};

									label = truncateLabel(label);

									const href = getBreadcrumbHref(localArray, index);

									let finalHref = href;
									if (
										href.includes("/prompts/") &&
										/^\/(?:[^/]+\/)?(?:[^/]+\/)?prompts\/\d+/.test(href)
									) {
										finalHref = href.replace("/prompts/", "/prompt/");
									}

									const pathWithoutQuery = finalHref.split("?")[0];
									if (
										/^\/(?:[^/]+\/)?(?:[^/]+\/)?prompt\/\d+$/.test(
											pathWithoutQuery,
										)
									) {
										finalHref = `${pathWithoutQuery}/playground`;
									}

									if (/\/settings\/user$/.test(pathWithoutQuery)) {
										finalHref = `${finalHref}/profile`;
									}
									if (/\/settings\/org$/.test(pathWithoutQuery)) {
										finalHref = `${finalHref}/details`;
									}
									if (/\/settings\/project$/.test(pathWithoutQuery)) {
										finalHref = `${finalHref}/details`;
									}

									return (
										<div key={index} className="flex items-center gap-2">
											{index !== 0 && <BreadcrumbSeparator />}
											<BreadcrumbItem>
												{isLast ? (
													<BreadcrumbPage>{label}</BreadcrumbPage>
												) : (
													<BreadcrumbLink asChild>
														<Link to={finalHref}>{label}</Link>
													</BreadcrumbLink>
												)}
											</BreadcrumbItem>
										</div>
									);
								})}
								{testcaseId && testcase?.name && (
									<div className="flex items-center gap-2">
										<BreadcrumbSeparator />
										<BreadcrumbItem>
											<BreadcrumbPage>
												{testcase.name.length > 50
													? testcase.name.substring(0, 50) + "..."
													: testcase.name}
											</BreadcrumbPage>
										</BreadcrumbItem>
									</div>
								)}
							</BreadcrumbList>
						</Breadcrumb>
						{isPromptPage && isPlayground && activePromptId === promptId && (
							<VersionStatus
								key={`${promptId}-${isCommitted}-${prompt?.prompt?.updatedAt}`}
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
				<main className="bg-white dark:bg-background h-full mainContent w-full flex justify-center pb-8">
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
			const viewport = document.querySelector("meta[name=viewport]");
			if (viewport) {
				viewport.setAttribute(
					"content",
					"width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
				);
			}
		} else {
			if (main) main.style.overflow = "auto";
			const viewport = document.querySelector("meta[name=viewport]");
			if (viewport) {
				viewport.setAttribute("content", "width=device-width, initial-scale=1");
			}
		}
		if (orientation === "landscape" && isMobile) {
			setTimeout(() => setOpen(false), 0);
			resetZoomEffect();
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

function resetZoomEffect() {
	resetViewportZoom();
	forceRepaint();
	document.body.style.zoom = "reset";
	setTimeout(() => {
		document.body.style.zoom = "1";
	}, 50);
}

function resetViewportZoom() {
	const oldViewport = document.querySelector('meta[name="viewport"]');
	if (oldViewport) {
		oldViewport.remove();
	}

	const newViewport = document.createElement("meta");
	newViewport.name = "viewport";
	newViewport.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no";
	document.head.appendChild(newViewport);
}

function forceRepaint() {
	window.scrollTo(0, 1);
	setTimeout(() => {
		window.scrollTo(0, 0);
	}, 50);
}
