import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TableSortButton from "@/components/ui/TableSortButton";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Trash2 } from "lucide-react";
import TestCaseStatus from "@/pages/prompt/playground-tabs/testcases/TestCaseStatus";
import { CommitAuthorAvatar } from "@/pages/prompt/utils/CommitAuthorAvatar";
import { formatCommitTime, formatUpdatedDate } from "../utils/date";
import type { Prompt } from "../utils/types";

type UsePromptsTableColumnsParams = {
	onDeletePrompt: (prompt: Prompt) => void;
};

export const usePromptsTableColumns = ({
	onDeletePrompt,
}: UsePromptsTableColumnsParams): ColumnDef<Prompt>[] => {
	return [
		{
			accessorKey: "name",
			header: ({ column }) => <TableSortButton column={column} headerText="Name" />,
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
						<span className="font-medium">{String(row.getValue("name"))}</span>
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
						<TestCaseStatus type="OK" value={statuses.OK || 0} />
						<TestCaseStatus type="NOK" value={statuses.NOK || 0} />
						<TestCaseStatus type="NEED_RUN" value={statuses.NEED_RUN || 0} />
					</div>
				);
			},
		},
		{
			accessorKey: "assertionType",
			header: ({ column }) => <TableSortButton column={column} headerText="Assertion Type" />,
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
			header: ({ column }) => <TableSortButton column={column} headerText="Updated" />,
			cell: ({ row }) => (
				<div className="flex items-center justify-center">
					{formatUpdatedDate(String(row.getValue("updatedAt")))}
				</div>
			),
		},
		{
			id: "actions",
			header: "Actions",
			cell: ({ row }) => (
				<Button
					variant="ghost"
					className="justify-start"
					onClick={() => onDeletePrompt(row.original)}
				>
					<Trash2 className="w-4 h-4" />
				</Button>
			),
		},
	];
};
