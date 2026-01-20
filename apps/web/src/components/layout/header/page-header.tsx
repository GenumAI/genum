import { useEffect, useState, useCallback } from "react";
import { useLocation, Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
import { usePromptById } from "@/hooks/usePrompt";
import { TestcaseAssertionModal } from "@/components/dialogs/TestcaseAssertionDialog";
import { TestStatus, TestCaseResponse } from "@/types/TestСase";
import { useAddParamsToUrl } from "@/lib/addParamsToUrl";
import { useQueryClient } from "@tanstack/react-query";
import { useTestcaseStatusCounts } from "@/hooks/useTestcaseStatusCounts";
import { Button } from "@/components/ui/button";
import { CircleAlert, CircleCheck, CirclePlus, Loader2 } from "lucide-react";
import clsx from "clsx";
import { testcasesApi } from "@/api/testcases/testcases.api";

type NavItem = {
	label: string;
	href: string;
	active?: boolean;
};

interface PageHeaderProps {
	title: string;
	navItems?: NavItem[];
}

export const getTestCaseIcon = (type: TestStatus, count = 1) => {
	const grayClass = "text-gray-500 dark:text-[#D4D4D8]";
	const iconSize = "w-4 h-4";

	const colorClass =
		count > 0
			? {
					OK: "text-[#2E9D2A]",
					NOK: "text-[#FF4545]",
					NEED_RUN: "text-[#FAAD15]",
				}[type]
			: grayClass;

	switch (type) {
		case "OK":
			return <CircleCheck className={clsx(iconSize, colorClass)} />;
		case "NOK":
			return <CirclePlus className={clsx(iconSize, "transform rotate-45", colorClass)} />;
		case "NEED_RUN":
			return <CircleAlert className={clsx(iconSize, colorClass)} />;
		default:
			return null;
	}
};

export function PageHeader({ title, navItems = [] }: PageHeaderProps) {
	const location = useLocation();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const testcaseId = searchParams.get("testcaseId");
	const addParamsToUrl = useAddParamsToUrl();

	const [isEditing, setIsEditing] = useState(false);
	const [editableTitle, setEditableTitle] = useState("");
	const [modalOpen, setModalOpen] = useState(false);
	const [modalTestcase, setModalTestcase] = useState<any>(null);
	const [isUpdating, setIsUpdating] = useState(false);
	const status = "";

	const { id, orgId, projectId } = useParams<{
		id: string;
		orgId: string;
		projectId: string;
	}>();
	const promptId = id ? Number(id) : undefined;

	const { data: testcaseStatusCounts } = useTestcaseStatusCounts(promptId);

	const { updatePromptName, prompt, loading: promptLoading } = usePromptById(promptId);
	const queryClient = useQueryClient();
	const [testcase, setTestcase] = useState<TestCaseResponse["testcase"] | null>(null);
	const [isTestcaseLoading, setIsTestcaseLoading] = useState(false);

	const fetchTestcase = useCallback(
		async (background = false) => {
			if (!testcaseId) {
				setTestcase(null);
				return null;
			}

			if (!background) setIsTestcaseLoading(true);
			try {
				const response = await testcasesApi.getTestcase(testcaseId);
				setTestcase(response.testcase);
				return response;
			} catch (error) {
				console.error("Failed to fetch testcase:", error);
				setTestcase(null);
				return null;
			} finally {
				if (!background) setIsTestcaseLoading(false);
			}
		},
		[testcaseId],
	);

	useEffect(() => {
		fetchTestcase();

		const handleTestcaseUpdated = () => {
			fetchTestcase(true);
		};

		window.addEventListener("testcaseUpdated", handleTestcaseUpdated);

		return () => {
			window.removeEventListener("testcaseUpdated", handleTestcaseUpdated);
		};
	}, [fetchTestcase]);

	const isPromptPage = /^\/(?:[^/]+\/)?(?:[^/]+\/)?prompt\/[^/]+\/[^/]+$/.test(location.pathname);
	const isVersionsPage = /^\/(?:[^/]+\/)?(?:[^/]+\/)?prompt\/\d+\/versions\/\d+\/?$/.test(
		location.pathname,
	);
	const isComparePage = /^\/(?:[^/]+\/)?(?:[^/]+\/)?prompt\/\d+\/compare\/?$/.test(
		location.pathname,
	);
	const isSettings = /^\/[^/]+\/[^/]+\/settings(?:\/.*)?$/.test(location.pathname);
	const isGetting = /^\/(?:[^/]+\/){2}getting-started\/?$/.test(location.pathname);

	useEffect(() => {
		if (prompt?.prompt) {
		}
	}, [prompt?.prompt]);

	const isLoadingData = () => {
		if (testcaseId) {
			return isTestcaseLoading;
		} else if (isPromptPage && promptId) {
			return promptLoading;
		}
		return false;
	};

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

	useEffect(() => {
		if (testcaseId && testcase?.name && isPromptPage) {
			setEditableTitle(testcase.name);
		} else if (prompt?.prompt?.name && isPromptPage) {
			setEditableTitle(prompt.prompt.name);
		} else if (!isLoadingData()) {
			setEditableTitle(title);
		}
	}, [title, testcase?.name, testcaseId, prompt?.prompt?.name, isPromptPage]);

	// reset modal window when changing testcase
	useEffect(() => {
		if (modalOpen) {
			setModalOpen(false);
			setModalTestcase(null);
		}
	}, [testcaseId]);

	const updateTestcaseName = async (name: string) => {
		if (!testcaseId) return;

		setIsUpdating(true);
		try {
			await testcasesApi.updateTestcase(testcaseId, { name });

			setEditableTitle(name);

			await fetchTestcase(true);
		} catch (error) {
			console.error("Error updating testcase name:", error);
			setEditableTitle(testcase?.name || title);
		} finally {
			setIsUpdating(false);
		}
	};

	const handlePromptRename = async (newTitle: string) => {
		if (!newTitle || newTitle.trim() === "") {
			setEditableTitle(prompt?.prompt?.name || title);
			return;
		}

		const trimmedTitle = newTitle.trim();

		if (trimmedTitle) {
			setIsUpdating(true);
			try {
				await updatePromptName({ name: trimmedTitle });
				setEditableTitle(trimmedTitle);

				window.dispatchEvent(
					new CustomEvent("promptNameChanged", {
						detail: { promptId, newName: trimmedTitle },
					}),
				);

				queryClient.invalidateQueries({ queryKey: ["prompt", promptId] });
			} catch (error) {
				console.error("Error updating prompt name:", error);
				setEditableTitle(prompt?.prompt?.name || title);
			} finally {
				setIsUpdating(false);
			}
		}
	};

	const handleTestcaseRename = async (newName: string) => {
		if (!newName || newName.trim() === "") {
			return;
		}

		const trimmedName = newName.trim();
		if (trimmedName) {
			await updateTestcaseName(trimmedName);
		}
	};

	const finishPromptEditing = async () => {
		setIsEditing(false);
		await handlePromptRename(editableTitle);

		if (promptId) {
			window.dispatchEvent(
				new CustomEvent("editingStateChanged", {
					detail: { promptId, isEditing: false },
				}),
			);
		}
	};

	const finishTestcaseEditing = async () => {
		setIsEditing(false);
		if (editableTitle) {
			await handleTestcaseRename(editableTitle);
		}

		if (promptId) {
			window.dispatchEvent(
				new CustomEvent("editingStateChanged", {
					detail: { promptId, isEditing: false },
				}),
			);
		}
	};

	const getCurrentTitle = () => {
		if (isEditing || isUpdating || editableTitle) {
			return editableTitle;
		}

		if (testcaseId && testcase?.name && isPromptPage) {
			return testcase.name;
		} else if (isPromptPage && prompt?.prompt?.name) {
			return prompt.prompt.name;
		}
		return title;
	};

	const startEditing = () => {
		const currentTitle = getCurrentTitle();
		setEditableTitle(currentTitle);
		setIsEditing(true);

		if (promptId) {
			window.dispatchEvent(
				new CustomEvent("editingStateChanged", {
					detail: { promptId, isEditing: true },
				}),
			);
		}
	};

	const shouldShowLoader = isLoadingData();

	const handleOpenModal = async () => {
		if (testcaseId) {
			const result = await fetchTestcase(true);
			if (result?.testcase) {
				setModalTestcase(result.testcase);
			} else {
				setModalTestcase(testcase);
			}
		} else {
			setModalTestcase(testcase);
		}
		setModalOpen(true);
	};

	return (
		<>
			{!isGetting && (
				<div className="w-full flex justify-center">
					<div
						className={clsx(
							`bg-background mt-2 ml-3 mb-3 mr-6 w-full peer-data-[collapsible=icon]:max-w-[1900px]`,
							!isPromptPage
								? "space-y-6 max-w-[1232px] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px] 2xl-plus:w-[70%] ml-3 mr-6 w-full mt-8"
								: "max-w-[1470px]",
							isPromptPage && !isComparePage ? "border-b border-border" : "",
						)}
					>
						<div className="container max-w-full flex flex-col gap-6">
							<div className="flex justify-between text-[#18181B] dark:text-foreground md:items-center gap-6 md:flex-row flex-col">
								{!isVersionsPage && !isComparePage && (
									<>
										<div className="w-full flex flex-row items-center gap-2">
											{isPromptPage && isEditing && !testcaseId ? (
												<input
													autoFocus
													value={editableTitle}
													onChange={(e) =>
														setEditableTitle(e.target.value)
													}
													onBlur={finishPromptEditing}
													onKeyDown={(e) => {
														if (e.key === "Enter") {
															e.preventDefault();
															finishPromptEditing();
														} else if (e.key === "Escape") {
															e.preventDefault();
															setIsEditing(false);
															setEditableTitle(
																prompt?.prompt?.name || title,
															);
															if (promptId) {
																window.dispatchEvent(
																	new CustomEvent(
																		"editingStateChanged",
																		{
																			detail: {
																				promptId,
																				isEditing: false,
																			},
																		},
																	),
																);
															}
														}
													}}
													className="w-full max-w-[60%] text-[21px] leading-[36px] h-[36px] font-bold bg-transparent outline-none border border-input px-2 py-0 rounded-md"
												/>
											) : testcaseId && isEditing && isPromptPage ? (
												<input
													autoFocus
													value={editableTitle}
													onChange={(e) =>
														setEditableTitle(e.target.value)
													}
													onBlur={finishTestcaseEditing}
													onKeyDown={(e) => {
														if (e.key === "Enter") {
															e.preventDefault();
															finishTestcaseEditing();
														} else if (e.key === "Escape") {
															e.preventDefault();
															setIsEditing(false);
															setEditableTitle(
																testcase?.name || title,
															);
															if (promptId) {
																window.dispatchEvent(
																	new CustomEvent(
																		"editingStateChanged",
																		{
																			detail: {
																				promptId,
																				isEditing: false,
																			},
																		},
																	),
																);
															}
														}
													}}
													className="w-full max-w-[60%] max-w-[480px] text-[21px] leading-[36px] h-[36px] font-bold bg-transparent outline-none border border-input px-2 py-0 rounded-md"
												/>
											) : (
												<>
													{isSettings ? (
														<h1 className="text-[30px] leading-[42px] font-bold">
															Settings
														</h1>
													) : shouldShowLoader ? (
														<div className="flex items-center gap-3">
															<div className="h-9 w-48 bg-muted animate-pulse rounded-md"></div>
															<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
														</div>
													) : (
														<div className="flex items-center gap-3">
															{isPromptPage ? (
																<h1
																	className={`text-[21px] leading-[36px] font-bold cursor-pointer hover:underline`}
																	onClick={() => {
																		if (
																			isPromptPage &&
																			!isUpdating
																		) {
																			startEditing();
																		}
																	}}
																>
																	{getCurrentTitle()}
																</h1>
															) : (
																<h1
																	className={`text-[30px] leading-[36px] font-bold `}
																	onClick={() => {
																		if (
																			isPromptPage &&
																			!isUpdating
																		) {
																			startEditing();
																		}
																	}}
																>
																	{getCurrentTitle()}
																</h1>
															)}
															{isPromptPage && !testcaseId && (
																<div className="flex items-center gap-1.5">
																	<div className="flex items-center gap-1">
																		<span className="text-sm font-medium text-muted-foreground">
																			{
																				testcaseStatusCounts.ok
																			}
																		</span>
																		{getTestCaseIcon(
																			"OK",
																			testcaseStatusCounts.ok,
																		)}
																	</div>
																	<div className="flex items-center gap-1">
																		<span className="text-sm font-medium text-muted-foreground">
																			{
																				testcaseStatusCounts.nok
																			}
																		</span>
																		{getTestCaseIcon(
																			"NOK",
																			testcaseStatusCounts.nok,
																		)}
																	</div>
																	<div className="flex items-center gap-1">
																		<span className="text-sm font-medium text-muted-foreground">
																			{
																				testcaseStatusCounts.needRun
																			}
																		</span>
																		{getTestCaseIcon(
																			"NEED_RUN",
																			testcaseStatusCounts.needRun,
																		)}
																	</div>
																</div>
															)}
															{isUpdating && (
																<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
															)}
														</div>
													)}
												</>
											)}

											<div>
												{isPromptPage && !isEditing && (
													<>
														{testcaseId ? (
															<div className="flex flex-row items-center text-gray-500">
																<Button
																	variant="ghost"
																	className="w-[22px] h-[22px] p-0"
																	onClick={handleOpenModal}
																>
																	{getTestCaseIcon(
																		(testcase?.status as TestStatus) ||
																			"NEED_RUN",
																	) ?? (
																		<CircleAlert className="w-4 h-4 text-gray-500" />
																	)}
																</Button>
															</div>
														) : null}
													</>
												)}
											</div>
										</div>
									</>
								)}
							</div>
						</div>

						{isPromptPage && !isComparePage && (
							<nav className="h-[48px]">
								<div className="h-[48px] container pl-1 max-w-full mx-auto flex overflow-x-auto">
									{navItems.map((item, index) => {
										const linkUrl = addParamsToUrl(item.href);

										return (
											<Link
												key={index}
												to={linkUrl}
												className={`text-sm font-normal py-1.5 ${
													item.active
														? "border-b-2 border-primary text-foreground hover:text-foreground"
														: "text-muted-foreground hover:text-muted-foreground"
												} flex-shrink-0`}
											>
												<span
													className={`md:px-3 px-2.5 py-2 block rounded-md ${
														item.active
															? ""
															: "hover:bg-muted hover:text-muted-foreground"
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

						{modalTestcase && (
							<TestcaseAssertionModal
								open={modalOpen}
								onClose={() => {
									setModalOpen(false);
									setModalTestcase(null);
								}}
								testcase={modalTestcase}
								status={status}
							/>
						)}
					</div>
				</div>
			)}
		</>
	);
}

export default PageHeader;
