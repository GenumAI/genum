import {
	useReactTable,
	getCoreRowModel,
	flexRender,
	ColumnDef,
	SortingState,
	getSortedRowModel,
} from "@tanstack/react-table";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useNavigate } from "react-router-dom";
import { useProjectPrompts } from "@/hooks/useProjectPrompts";
import { useDeletePrompt } from "@/hooks/useDeletePrompt";
import { useAddParamsToUrl } from "@/lib/addParamsToUrl";

import { useState, useMemo } from "react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Ellipsis, Copy, Trash2, ChevronsUpDown, PlusCircle, Loader2 } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
	TooltipArrow,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogTitle,
	DialogDescription,
	DialogContent,
	DialogHeader,
	DialogFooter,
} from "@/components/ui/dialog";

import { Row } from "@tanstack/react-table";
import TestCaseStatus from "@/pages/prompt/playground-tabs/testcases/TestCaseStatus";
import { SearchInput } from "@/components/ui/searchInput";
import { TestcaseStatuses } from "@/types/Prompt";

import { usePromptById } from "@/hooks/usePrompt";
import { useCreatePrompt } from "@/hooks/useCreatePrompt";
import { EmptyState } from "@/pages/info-pages/EmptyState";
import { CommitAuthorAvatar } from "@/pages/prompt/utils/CommitAuthorAvatar";

export interface Prompt {
	id: number;
	name: string;
	value: string;
	assertionType: string;
	updatedAt: string;
	createdAt: string;
	testcaseStatuses: TestcaseStatuses;
	commited?: boolean;
	memories: {
		length: number;
	};
	lastCommit: {
		commitHash: string;
		createdAt: string;
		author: {
			id: number;
			name: string;
			email: string;
			picture?: string | null;
		};
	} | null;
	_count: {
		memories: number;
		testCases: number;
	};
}

export default function TestcaseTable() {
	const { prompts, loading: promptsLoading, removePromptLocally } = useProjectPrompts();
	const [search, setSearch] = useState("");
	const [openPromptId, setOpenPromptId] = useState<number | null>(null);
	const [deleteModal, setDeleteModal] = useState<{ open: boolean; prompt?: Prompt }>({
		open: false,
	});
	const [confirmInput, setConfirmInput] = useState("");
	const [duplicateModal, setDuplicateModal] = useState<{
		open: boolean;
		prompt?: Prompt;
	}>({ open: false });

	const [duplicateOptions, setDuplicateOptions] = useState({
		testcases: true,
		memory: false,
		assertions: true,
	});

	const { createPrompt, loading } = useCreatePrompt();
	const { addPromptLocally } = useProjectPrompts();

	const [expanded, setExpanded] = useState(false);
	const [sorting, setSorting] = useState<SortingState>([]);

	const { deletePrompt, loading: deleting } = useDeletePrompt();

	const isInvalid = confirmInput !== "" && confirmInput !== deleteModal.prompt?.name;

	const navigate = useNavigate();
	const addParamsToUrl = useAddParamsToUrl();

	// Функция для форматирования времени коммита
	const formatCommitTime = (dateString: string) => {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30));
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

		if (diffMonths > 0) {
			return `${diffMonths}mo ago`;
		} else if (diffDays > 0) {
			return `${diffDays}d ago`;
		} else if (diffHours > 0) {
			return `${diffHours}h ago`;
		} else if (diffMinutes > 0) {
			return `${diffMinutes}m ago`;
		} else {
			return "just now";
		}
	};

	const columns: ColumnDef<Prompt>[] = [
		{
			accessorKey: "name",
			header: ({ column }) => {
				return (
					<div
						className="flex items-center cursor-pointer"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						<span className="font-medium">Name</span>
						{column.getIsSorted() === "asc" ? (
							<span className="flex flex-col ml-1">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="lucide lucide-chevron-up h-3 w-4 text-foreground"
								>
									<path d="m18 15-6-6-6 6"></path>
								</svg>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="lucide lucide-chevron-down h-3 w-4 mt-[-5px] text-muted-foreground"
								>
									<path d="m6 9 6 6 6-6"></path>
								</svg>
							</span>
						) : column.getIsSorted() === "desc" ? (
							<span className="flex flex-col ml-1">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="lucide lucide-chevron-up h-3 w-4 text-muted-foreground"
								>
									<path d="m18 15-6-6-6 6"></path>
								</svg>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="lucide lucide-chevron-down h-3 w-4 mt-[-5px] text-foreground"
								>
									<path d="m6 9 6 6 6-6"></path>
								</svg>
							</span>
						) : (
							<ChevronsUpDown className="ml-1 h-4 w-4" />
						)}
					</div>
				);
			},
			cell: ({ row }) => {
				const isCommitted = row.original.commited;

				return (
					<div className="flex flex-row items-center gap-1.5">
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<div
										className={`w-2 h-2 rounded-xl ${
											isCommitted ? "bg-[#2da44a]" : "bg-[#fbbf24]"
										}`}
									></div>
								</TooltipTrigger>
								<TooltipContent className="py-[6px] px-3">
									<span className="text-[12px]">
										{isCommitted ? "Committed" : "Uncommitted"}
									</span>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
						<span className="font-medium">{row.getValue("name")}</span>
					</div>
				);
			},
		},
		{
			id: "status",
			header: "Testcases Status",
			cell: ({ row }) => {
				const statuses = row.original.testcaseStatuses || {};
				return (
					<div className="flex justify-center gap-2 [&_svg]:size-4">
						<TestCaseStatus type={"OK"} value={statuses.OK || 0} />
						<TestCaseStatus type={"NOK"} value={statuses.NOK || 0} />
						<TestCaseStatus type={"NEED_RUN"} value={statuses.NEED_RUN || 0} />
					</div>
				);
			},
		},
		{
			accessorKey: "assertionType",
			header: ({ column }) => {
				return (
					<div
						className="flex items-center justify-center cursor-pointer"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						<span className="font-medium">Assertion Type</span>
						{column.getIsSorted() === "asc" ? (
							<span className="flex flex-col ml-1">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="lucide lucide-chevron-up h-3 w-4 text-foreground"
								>
									<path d="m18 15-6-6-6 6"></path>
								</svg>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="lucide lucide-chevron-down h-3 w-4 mt-[-5px] text-muted-foreground"
								>
									<path d="m6 9 6 6 6-6"></path>
								</svg>
							</span>
						) : column.getIsSorted() === "desc" ? (
							<span className="flex flex-col ml-1">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="lucide lucide-chevron-up h-3 w-4 text-muted-foreground"
								>
									<path d="m18 15-6-6-6 6"></path>
								</svg>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="lucide lucide-chevron-down h-3 w-4 mt-[-5px] text-foreground"
								>
									<path d="m6 9 6 6 6-6"></path>
								</svg>
							</span>
						) : (
							<ChevronsUpDown className="ml-1 h-4 w-4" />
						)}
					</div>
				);
			},
			cell: ({ row }) => {
				const value = row.getValue("assertionType") as string;
				const color =
					value === "STRICT"
						? "bg-[#2A9D90] dark:bg-[#27786F]"
						: value === "MANUAL"
							? "bg-[#6C98F2] dark:bg-[#5674B3]"
							: "bg-[#B66AD6] dark:bg-[#8954A0]";
				return (
					<Badge
						className={`${color} shadow-none rounded-[50px] text-[color:#FAFAFA] font-sans text-[12px] h-[20px] not-italic font-semibold leading-[16px]`}
					>
						{value.toLowerCase() === "ai"
							? "AI"
							: value.charAt(0) + value.slice(1).toLowerCase()}
					</Badge>
				);
			},
		},
		{
			id: "commit",
			header: "Commits",
			cell: ({ row }) => {
				const lastCommit = row.original.lastCommit;

				if (!lastCommit) return null;

				return (
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="flex items-center justify-center cursor-pointer gap-2">
									<CommitAuthorAvatar author={lastCommit.author} />
									<span className="text-xs text-muted-foreground">
										{formatCommitTime(lastCommit.createdAt)}
									</span>
								</div>
							</TooltipTrigger>
							<TooltipContent side="bottom" className="py-[6px] px-3 max-w-xs">
								<div className="space-y-1">
									<div className="text-[12px] font-medium text-white">
										{lastCommit.author.name}
									</div>
									<div className="text-[11px] text-white/80">
										{lastCommit.author.email}
									</div>
									<div className="text-[11px] text-white/80">
										Hash: {lastCommit.commitHash.substring(0, 8)}
									</div>
									<div className="text-[11px] text-white/80">
										{new Date(lastCommit.createdAt).toLocaleString()}
									</div>
								</div>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				);
			},
		},
		{
			accessorKey: "updatedAt",
			header: ({ column }) => {
				return (
					<div
						className="flex items-center justify-center cursor-pointer"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						<span className="font-medium">Updated</span>
						{column.getIsSorted() === "asc" ? (
							<span className="flex flex-col ml-1">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="lucide lucide-chevron-up h-3 w-4 text-foreground"
								>
									<path d="m18 15-6-6-6 6"></path>
								</svg>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="lucide lucide-chevron-down h-3 w-4 mt-[-5px] text-muted-foreground"
								>
									<path d="m6 9 6 6 6-6"></path>
								</svg>
							</span>
						) : column.getIsSorted() === "desc" ? (
							<span className="flex flex-col ml-1">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="lucide lucide-chevron-up h-3 w-4 text-muted-foreground"
								>
									<path d="m18 15-6-6-6 6"></path>
								</svg>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="lucide lucide-chevron-down h-3 w-4 mt-[-5px] text-foreground"
								>
									<path d="m6 9 6 6 6-6"></path>
								</svg>
							</span>
						) : (
							<ChevronsUpDown className="ml-1 h-4 w-4" />
						)}
					</div>
				);
			},
			cell: ({ row }) => {
				const date = new Date(row.getValue("updatedAt"));
				const formattedDate = date.toLocaleDateString("en-US", {
					year: "numeric",
					month: "short",
					day: "numeric",
				});

				return <div className="flex items-center justify-center">{formattedDate}</div>;
			},
		},
		{
			id: "actions",
			header: "Actions",
			cell: ({ row }) => {
				const prompt = row.original;

				return (
					<Button
						variant="ghost"
						className="justify-start"
						onClick={() => {
							setOpenPromptId(null);
							setDeleteModal({ open: true, prompt });
						}}
					>
						<Trash2 className="w-4 h-4" />
					</Button>
				);
			},
		},
	];

	const filteredData = useMemo(() => {
		if (!prompts) return [];

		return (prompts as Prompt[]).filter((prompt) => {
			const nameMatches = !search || prompt.name.toLowerCase().includes(search.toLowerCase());

			return nameMatches;
		});
	}, [prompts, search]);

	const table = useReactTable({
		data: filteredData,
		columns,
		getCoreRowModel: getCoreRowModel(),
		state: {
			sorting,
		},
		onSortingChange: setSorting,
		getSortedRowModel: getSortedRowModel(),
	});

	const handleRowClick = (row: Row<Prompt>) => {
		navigate(addParamsToUrl(`/prompt/${row.original.id}/playground`));
	};

	const handleCreatePrompt = async () => {
		try {
			const newPromptCount = prompts
				? prompts.filter((p) => p.name.startsWith("New Prompt")).length + 1
				: 1;
			const promptName = `New Prompt ${newPromptCount}`;

			const newPrompt = await createPrompt({ name: promptName, value: "" });

			if (!newPrompt?.id) return;

			addPromptLocally(newPrompt);
			navigate(addParamsToUrl(`/prompt/${newPrompt.id}/playground`));
		} catch (err) {
			console.error("Error:", err);
		}
	};

	return (
		<div className="space-y-6 max-w-[1232px] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px] 2xl-plus:w-[70%] ml-3 mr-6 w-full pt-6">
			<div className="flex justify-between items-center">
				<div className="flex gap-3">
					<SearchInput
						placeholder="Search..."
						className="min-w-[241px]"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</div>
				<Button onClick={handleCreatePrompt} disabled={loading} className="min-w-[186px]">
					<PlusCircle className="mr-2 h-4 w-4" />
					Create prompt
				</Button>
			</div>
			<div className="rounded-md overflow-auto">
				<Table>
					<TableHeader className="bg-[#F4F4F5] text-[#71717A] dark:bg-[#27272A] dark:text-[#fff] text-sm font-medium leading-5 h-[54px]">
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow
								key={headerGroup.id}
								className="[&_th:first-child]:text-left [&_th:last-child]:text-right group py-[14px] h-[48px] leading-[16px]"
							>
								{headerGroup.headers.map((header) => (
									<TableHead
										key={header.id}
										className="h-auto py-[16px] px-[14px]"
									>
										{flexRender(
											header.column.columnDef.header,
											header.getContext(),
										)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{promptsLoading ? (
							<TableRow>
								<TableCell colSpan={columns.length} className="h-24 text-center">
									<Loader2 className="mx-auto h-8 w-8 animate-spin" />
								</TableCell>
							</TableRow>
						) : table.getRowModel().rows.length > 0 ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									className="cursor-pointer [&_td:first-child]:text-left [&_td:last-child]:text-right h-[62px]"
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell
											key={cell.id}
											className="text-center"
											onClick={
												cell.column.id !== "actions" &&
												cell.column.id !== "select"
													? () => handleRowClick(row)
													: undefined
											}
											style={{
												cursor:
													cell.column.id === "name"
														? "pointer"
														: undefined,
											}}
										>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow className="transition-none">
								<TableCell
									colSpan={columns.length}
									className="px-0 hover:bg-[#fff] dark:hover:bg-[#212121]"
								>
									<EmptyState title="No results found" description="" />
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			<Dialog open={deleteModal.open} onOpenChange={(open) => setDeleteModal({ open })}>
				<VisuallyHidden>
					<DialogTitle>DialogTitle</DialogTitle>
					<DialogDescription>DialogDescription</DialogDescription>
				</VisuallyHidden>
				<DialogContent>
					<DialogHeader className="font-sans text-lg font-semibold leading-normal text-[color:#18181B] dark:text-[#f4f4f4]">
						To delete prompt "{deleteModal.prompt?.name}" type prompt title.
					</DialogHeader>
					<p className="text-sm text-muted-foreground dark:text-[#f4f4f4]">
						This prompt includes
						<span className="font-bold">
							{" "}
							{(deleteModal.prompt?.testcaseStatuses?.OK || 0) +
								(deleteModal.prompt?.testcaseStatuses?.NOK || 0) +
								(deleteModal.prompt?.testcaseStatuses?.NEED_RUN || 0)}{" "}
							testcases
						</span>
						,
						<span className="font-bold">
							{" "}
							{deleteModal.prompt?._count?.memories || 0} memories
						</span>
						. This action cannot be undone.{" "}
						<span className="text-destructive dark:text-[#D64646]">
							All data will be lost.
						</span>
					</p>
					<Input
						placeholder="Prompt title"
						value={confirmInput}
						onChange={(e) => setConfirmInput(e.target.value)}
					/>
					{isInvalid && <p className="text-sm text-destructive">Prompt title invalid.</p>}
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteModal({ open: false })}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={async () => {
								if (
									confirmInput === deleteModal.prompt?.name &&
									deleteModal.prompt?.id
								) {
									const success = await deletePrompt(deleteModal.prompt.id);
									if (success) {
										removePromptLocally(deleteModal.prompt.id);
										setDeleteModal({ open: false });
										setConfirmInput("");
									}
								}
							}}
							disabled={confirmInput !== deleteModal.prompt?.name || deleting}
						>
							{deleting ? "Deleting..." : "Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={duplicateModal.open} onOpenChange={(open) => setDuplicateModal({ open })}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle className="text-lg font-semibold text-[#18181B]">
							Duplicate Prompt
						</DialogTitle>
					</DialogHeader>

					<div className="flex flex-col gap-4">
						<div className="flex items-center justify-between">
							<h3 className="text-base font-medium text-[#18181B] mb-1">
								"{duplicateModal.prompt?.name}"
							</h3>

							<div className="flex justify-center gap-2 [&_svg]:size-4">
								<TestCaseStatus
									type={"OK"}
									value={duplicateModal.prompt?.testcaseStatuses?.OK || 0}
								/>
								<TestCaseStatus
									type={"NOK"}
									value={duplicateModal.prompt?.testcaseStatuses?.NOK || 0}
								/>
								<TestCaseStatus
									type={"NEED_RUN"}
									value={duplicateModal.prompt?.testcaseStatuses?.NEED_RUN || 0}
								/>
							</div>
						</div>

						<div className="flex items-center justify-start gap-[10px]">
							<div className="text-[10px] text-[#71717A] font-semibold">
								Updated{" "}
								{duplicateModal.prompt?.updatedAt &&
									new Date(duplicateModal.prompt.updatedAt).toLocaleDateString(
										"de-DE",
										{
											day: "2-digit",
											month: "2-digit",
											year: "numeric",
										},
									)}
							</div>
							<div className="text-[10px] text-[#71717A]">
								Commit{" "}
								<span className="underline">
									{duplicateModal.prompt?.lastCommit?.commitHash?.substring(0, 8)}
								</span>
							</div>
						</div>
					</div>

					<div className="mb-4">
						<p className="text-xs text-muted-foreground font-medium mb-1">
							Prompt Value
						</p>

						<div className="relative">
							<Textarea
								readOnly
								value={duplicateModal.prompt?.value}
								placeholder="Enter your prompt logic here..."
								className={`min-h-[60px] bg-[#F4F4F5] border-0 focus-visible:ring-0 focus-visible:outline-none w-full resize-none transition-all duration-300 ease-in-out ${
									expanded ? "h-[350px]" : "h-[60px]"
								}`}
							/>

							<button
								onClick={() => setExpanded(!expanded)}
								className="absolute top-1 right-1"
							>
								{expanded ? (
									<svg
										width="18"
										height="19"
										viewBox="0 0 18 19"
										fill="none"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path
											d="M7.98667 13.0638V10.0771H5"
											stroke="#09090B"
											strokeWidth="0.8"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
										<path
											d="M10.0133 5.07681V8.06348H13"
											stroke="#09090B"
											strokeWidth="0.8"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								) : (
									<svg
										width="19"
										height="18"
										viewBox="0 0 19 18"
										fill="none"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path
											d="M5.02734 10.0133V13H8.01401M13.0273 7.98667V5H10.0407"
											stroke="#09090B"
											strokeWidth="0.8"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								)}
							</button>
						</div>
					</div>

					<div>
						<p className="text-sm font-medium text-[#18181B] mb-2">Duplicate Options</p>
						<div className="space-y-3">
							<div className="flex items-center space-x-2">
								<Checkbox
									id="all"
									checked={Object.values(duplicateOptions).every(Boolean)}
									onCheckedChange={() => {
										const allChecked =
											Object.values(duplicateOptions).every(Boolean);
										setDuplicateOptions({
											testcases: !allChecked,
											memory: !allChecked,
											assertions: !allChecked,
										});
									}}
								/>
								<label htmlFor="all" className="text-sm font-medium text-[#18181B]">
									All
								</label>
							</div>

							<div className="flex items-center space-x-2">
								<Checkbox
									id="testcases"
									checked={duplicateOptions.testcases}
									onCheckedChange={() =>
										setDuplicateOptions((prev) => ({
											...prev,
											testcases: !prev.testcases,
										}))
									}
								/>
								<label
									htmlFor="testcases"
									className="text-sm font-medium text-[#18181B]"
								>
									{" "}
									{(duplicateModal.prompt?.testcaseStatuses?.OK || 0) +
										(duplicateModal.prompt?.testcaseStatuses?.NOK || 0) +
										(duplicateModal.prompt?.testcaseStatuses?.NEED_RUN ||
											0)}{" "}
									Testcases
								</label>
							</div>

							<div className="flex items-center space-x-2">
								<Checkbox
									id="memory"
									checked={duplicateOptions.memory}
									onCheckedChange={() =>
										setDuplicateOptions((prev) => ({
											...prev,
											memory: !prev.memory,
										}))
									}
								/>
								<label
									htmlFor="memory"
									className="text-sm font-medium text-[#18181B]"
								>
									{" "}
									{duplicateModal.prompt?._count?.memories || 0} Memory
								</label>
							</div>

							<div className="flex items-center space-x-2">
								<Checkbox
									id="assertions"
									checked={duplicateOptions.assertions}
									onCheckedChange={() =>
										setDuplicateOptions((prev) => ({
											...prev,
											assertions: !prev.assertions,
										}))
									}
								/>
								<label
									htmlFor="assertions"
									className="text-sm font-medium text-[#18181B]"
								>
									{" "}
									{duplicateModal.prompt?.assertionType[0].length || 0} Assortions
								</label>
							</div>
						</div>
					</div>

					<DialogFooter className="mt-6">
						<Button
							variant="outline"
							onClick={() => setDuplicateModal({ open: false })}
						>
							Cancel
						</Button>
						<Button
							onClick={() => {
								setDuplicateModal({ open: false });
							}}
						>
							Create
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
