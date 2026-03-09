import { useEffect, useMemo } from "react";
import { useLocation, Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
import { usePromptById } from "@/hooks/usePrompt";
import { TestcaseAssertionModal } from "@/components/dialogs/TestcaseAssertionDialog";
import type { TestStatus } from "@/types/TestСase";
import { useAddParamsToUrl } from "@/lib/addParamsToUrl";
import { useToast } from "@/hooks/useToast";
import { useTestcaseStatusCounts } from "@/hooks/useTestcaseStatusCounts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CircleAlert } from "lucide-react";
import clsx from "clsx";
import { getOrgId, getProjectId } from "@/api/client";
import usePlaygroundStore from "@/stores/playground.store";
import { useHeaderTestcase } from "./hooks/useHeaderTestcase";
import { getPageHeaderRouteState } from "./utils/pageHeaderRoute";
import { getTestCaseIcon } from "./utils/testcaseIcon";
import { PageHeaderTitleInput } from "./components/PageHeaderTitleInput";
import { useShallow } from "zustand/react/shallow";

type NavItem = {
	label: string;
	href: string;
	active?: boolean;
};

interface PageHeaderProps {
	title: string;
	navItems?: NavItem[];
}

export function PageHeader({ title, navItems = [] }: PageHeaderProps) {
	const location = useLocation();
	const navigate = useNavigate();
	const { toast } = useToast();
	const [searchParams] = useSearchParams();
	const testcaseId = searchParams.get("testcaseId");
	const addParamsToUrl = useAddParamsToUrl();
	const {
		isEditing,
		editableTitle,
		modalOpen,
		isUpdating,
		setPageHeaderUi,
		resetPageHeaderUi,
	} = usePlaygroundStore(
		useShallow((state) => ({
			isEditing: state.pageHeaderUi.isEditing,
			editableTitle: state.pageHeaderUi.editableTitle,
			modalOpen: state.pageHeaderUi.modalOpen,
			isUpdating: state.pageHeaderUi.isUpdating,
			setPageHeaderUi: state.setPageHeaderUi,
			resetPageHeaderUi: state.resetPageHeaderUi,
		})),
	);
	const status = "";

	const { id } = useParams<{ id: string }>();
	const orgId = getOrgId();
	const projectId = getProjectId();
	const promptId = id ? Number(id) : undefined;

	const routeState = useMemo(() => getPageHeaderRouteState(location.pathname), [location.pathname]);
	const { isPromptPage, isVersionsPage, isComparePage, isSettings, isGetting } = routeState;

	const { data: testcaseStatusCounts } = useTestcaseStatusCounts(promptId);
	const { updatePrompt, prompt, loading: promptLoading, initialLoading: promptInitialLoading } =
		usePromptById(promptId);

	const { testcase, isTestcaseLoading, refreshTestcase, renameTestcase } = useHeaderTestcase(
		testcaseId,
		promptId,
	);

	const shouldShowLoader = testcaseId
		? isTestcaseLoading
		: isPromptPage && promptId
			? promptInitialLoading
			: false;
	const resolvedTitle = testcaseId && testcase?.name && isPromptPage
		? testcase.name
		: isPromptPage && prompt?.prompt?.name
			? prompt.prompt.name
			: title;

	useEffect(() => {
		resetPageHeaderUi();
	}, [resetPageHeaderUi]);

	useEffect(() => {
		if (isPromptPage && promptId && orgId && projectId && !promptLoading && !prompt) {
			const timer = setTimeout(() => {
				if (!prompt && !promptLoading) {
					navigate(`/${orgId}/${projectId}/prompts`, { replace: true });
				}
			}, 100);

			return () => clearTimeout(timer);
		}

		if (testcaseId && !isTestcaseLoading && !testcase && isPromptPage && orgId && projectId) {
			const timer = setTimeout(() => {
				if (!testcase && !isTestcaseLoading) {
					const currentUrl = new URL(window.location.href);
					currentUrl.searchParams.delete("testcaseId");
					navigate(currentUrl.pathname + currentUrl.search, { replace: true });
				}
			}, 100);

			return () => clearTimeout(timer);
		}
	}, [
		promptLoading,
		prompt,
		isTestcaseLoading,
		testcase,
		promptId,
		testcaseId,
		isPromptPage,
		orgId,
		projectId,
		navigate,
	]);

	const getCurrentTitle = () => {
		if (isEditing || isUpdating) {
			return editableTitle || resolvedTitle;
		}
		return resolvedTitle;
	};

	const startEditing = () => {
		setPageHeaderUi({
			editableTitle: resolvedTitle,
			isEditing: true,
		});
	};

	const cancelEditing = () => {
		setPageHeaderUi({
			isEditing: false,
			editableTitle: resolvedTitle,
		});
	};

	const handlePromptRename = async (newTitle: string) => {
		if (!newTitle || newTitle.trim() === "") {
			setPageHeaderUi({ editableTitle: prompt?.prompt?.name || title });
			return;
		}

		const trimmedTitle = newTitle.trim();
		if (!trimmedTitle) return;

		try {
			await updatePrompt({ name: trimmedTitle });
			setPageHeaderUi({ editableTitle: trimmedTitle });
		} catch (error) {
			console.error("Error updating prompt name:", error);
			setPageHeaderUi({ editableTitle: prompt?.prompt?.name || title });
			toast({
				title: "Rename failed",
				description: "Failed to update prompt name",
				variant: "destructive",
			});
		} finally {
			setPageHeaderUi({ isUpdating: false });
		}
	};

	const handleTestcaseRename = async (newName: string) => {
		if (!newName || newName.trim() === "") {
			return;
		}

		const trimmedName = newName.trim();
		if (!trimmedName) return;

		try {
			await renameTestcase(trimmedName);
			setPageHeaderUi({ editableTitle: trimmedName });
		} catch (error) {
			console.error("Error updating testcase name:", error);
			setPageHeaderUi({ editableTitle: testcase?.name || title });
			toast({
				title: "Rename failed",
				description: "Failed to update testcase title.",
				variant: "destructive",
			});
		} finally {
			setPageHeaderUi({ isUpdating: false });
		}
	};

	const finishEditing = async () => {
		const nextTitle = editableTitle?.trim();
		if (!nextTitle) {
			setPageHeaderUi({ isEditing: false, editableTitle: resolvedTitle });
			return;
		}

		setPageHeaderUi({ isEditing: false, isUpdating: true, editableTitle: nextTitle });
		if (testcaseId) {
			await handleTestcaseRename(nextTitle);
			return;
		}
		await handlePromptRename(nextTitle);
	};

	const handleOpenModal = async () => {
		if (testcase?.status === "NEED_RUN") {
			return;
		}
		if (testcaseId) {
			await refreshTestcase();
		}
		setPageHeaderUi({ modalOpen: true });
	};

	return (
		<>
			{!isGetting && (
				<div className="w-full flex justify-center">
					<div
						className={clsx(
							"bg-background mt-2 ml-3 mb-3 mr-6 w-full peer-data-[collapsible=icon]:max-w-[1900px]",
							!isPromptPage
								? "space-y-6 max-w-[1232px] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px] 2xl-plus:w-[70%] ml-3 mr-6 w-full mt-8"
								: "max-w-[1470px]",
							isPromptPage && !isComparePage ? "border-b border-border" : "",
						)}
					>
						<div className="container max-w-full flex flex-col gap-6">
							<div className="flex justify-between text-[#18181B] dark:text-foreground md:items-center gap-6 md:flex-row flex-col">
								{!isVersionsPage && !isComparePage && (
									<div className="w-full flex flex-row items-center gap-2">
										{isPromptPage && isEditing && !testcaseId ? (
											<PageHeaderTitleInput
												value={editableTitle}
												onChange={(value) => setPageHeaderUi({ editableTitle: value })}
												onSubmit={() => {
													void finishEditing();
												}}
												onCancel={cancelEditing}
												className="w-full max-w-[60%] text-[21px] leading-[36px] h-[36px] font-bold bg-transparent outline-none border border-input px-2 py-0 rounded-md"
											/>
										) : testcaseId && isEditing && isPromptPage ? (
											<PageHeaderTitleInput
												value={editableTitle}
												onChange={(value) => setPageHeaderUi({ editableTitle: value })}
												onSubmit={() => {
													void finishEditing();
												}}
												onCancel={cancelEditing}
												className="w-full max-w-[60%] max-w-[480px] text-[21px] leading-[36px] h-[36px] font-bold bg-transparent outline-none border border-input px-2 py-0 rounded-md"
											/>
										) : isSettings ? (
											<h1 className="text-[30px] leading-[42px] font-bold">Settings</h1>
										) : shouldShowLoader ? (
											<div className="flex items-center gap-3">
												<Skeleton className="h-9 w-48" />
											</div>
										) : (
											<div className="flex items-center gap-3">
												{isPromptPage ? (
													<h1
														className="text-[21px] leading-[36px] font-bold cursor-pointer hover:underline"
														tabIndex={isUpdating ? -1 : 0}
														onClick={() => {
															if (!isUpdating) {
																startEditing();
															}
														}}
														onKeyDown={(event) => {
															if (isUpdating) return;
															if (event.key === "Enter" || event.key === " ") {
																event.preventDefault();
																startEditing();
															}
														}}
													>
														{getCurrentTitle()}
													</h1>
												) : (
													<h1 className="text-[30px] leading-[36px] font-bold">{getCurrentTitle()}</h1>
												)}
												{isPromptPage && !testcaseId && (
													<div className="flex items-center gap-1.5">
														<div className="flex items-center gap-1">
															<span className="text-sm font-medium text-muted-foreground">
																{testcaseStatusCounts.ok}
															</span>
															{getTestCaseIcon("OK", testcaseStatusCounts.ok)}
														</div>
														<div className="flex items-center gap-1">
															<span className="text-sm font-medium text-muted-foreground">
																{testcaseStatusCounts.nok}
															</span>
															{getTestCaseIcon("NOK", testcaseStatusCounts.nok)}
														</div>
														<div className="flex items-center gap-1">
															<span className="text-sm font-medium text-muted-foreground">
																{testcaseStatusCounts.needRun}
															</span>
															{getTestCaseIcon("NEED_RUN", testcaseStatusCounts.needRun)}
														</div>
													</div>
												)}
											</div>
										)}

										<div>
											{isPromptPage && !isEditing && testcaseId && (
												<div className="flex flex-row items-center text-gray-500">
													<Button
														variant="ghost"
														className="w-[22px] h-[22px] p-0"
														onClick={() => {
															void handleOpenModal();
														}}
													>
														{getTestCaseIcon((testcase?.status as TestStatus) || "NEED_RUN") ?? (
															<CircleAlert className="w-4 h-4 text-gray-500" />
														)}
													</Button>
												</div>
											)}
										</div>
									</div>
								)}
							</div>
						</div>

						{isPromptPage && !isComparePage && (
							<nav className="h-[48px]">
								<div className="h-[48px] container pl-1 max-w-full mx-auto flex overflow-x-auto">
									{navItems.map((item) => {
										const linkUrl = addParamsToUrl(item.href);

										return (
											<Link
												key={item.href}
												to={linkUrl}
												className={`text-sm font-normal py-1.5 ${
													item.active
														? "border-b-2 border-primary text-foreground hover:text-foreground"
														: "text-muted-foreground hover:text-muted-foreground"
												} flex-shrink-0`}
											>
												<span
													className={`md:px-3 px-2.5 py-2 block rounded-md ${
														item.active ? "" : "hover:bg-muted hover:text-muted-foreground"
													}`}
												>
													{item.label}
												</span>
											</Link>
										);
									})}
								</div>
							</nav>
						)}

						{testcase && testcaseId && (
							<TestcaseAssertionModal
								open={modalOpen}
								onClose={() => {
									setPageHeaderUi({ modalOpen: false });
								}}
								testcase={testcase}
								status={status}
								assertionType={prompt?.prompt?.assertionType || "AI"}
							/>
						)}
					</div>
				</div>
			)}
		</>
	);
}

export default PageHeader;
