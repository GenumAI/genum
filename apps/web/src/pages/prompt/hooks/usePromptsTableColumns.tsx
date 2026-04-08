import type { ColumnDef } from "@tanstack/react-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TableSortButton from "@/components/ui/TableSortButton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Trash2 } from "lucide-react";
import { isCloudAuth } from "@/lib/auth";
import { getAvatarColor, getAvatarInitial } from "@/lib/avatarUtils";
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
										className={`h-2 w-2 rounded-xl ${
											isCommitted ? "bg-success" : "bg-warning"
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
			header: ({ column }) => (
				<div className="flex justify-center">
					<TableSortButton column={column} headerText="Assertion Type" />
				</div>
			),
			cell: ({ row }) => {
				const value = row.getValue("assertionType") as string;
				const color =
					value === "STRICT"
						? "bg-chart-2"
						: value === "MANUAL"
							? "bg-chart-7"
							: "bg-chart-4";
				return (
					<div className="flex justify-center">
						<Badge
							className={`${color} shadow-none rounded-[50px] text-primary-foreground font-sans text-[12px] h-[20px] not-italic font-semibold leading-[16px]`}
						>
							{value.toLowerCase() === "ai"
								? "AI"
								: value.charAt(0) + value.slice(1).toLowerCase()}
						</Badge>
					</div>
				);
			},
		},
		{
			id: "commit",
			header: "Commits",
			cell: ({ row }) => {
				const lastCommit = row.original.lastCommit;

				if (!lastCommit) return null;

				const isCloud = isCloudAuth();
				const commitAuthor = lastCommit.author;
				const cloudAvatarUrl = commitAuthor.avatar || commitAuthor.picture;
				const authorInitial = getAvatarInitial(commitAuthor.name);
				const authorColor = getAvatarColor(commitAuthor.name);

				return (
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="flex items-center justify-center cursor-pointer gap-2">
									{isCloud ? (
										<Avatar className="h-5 w-5 rounded-full">
											<AvatarImage
												src={cloudAvatarUrl ?? undefined}
												alt={commitAuthor.name}
											/>
											<AvatarFallback
												className={`text-[10px] font-bold ${authorColor}`}
											>
												{authorInitial}
											</AvatarFallback>
										</Avatar>
									) : (
										<CommitAuthorAvatar author={commitAuthor} />
									)}
									<span className="text-xs text-muted-foreground">
										{formatCommitTime(lastCommit.createdAt)}
									</span>
								</div>
							</TooltipTrigger>
							<TooltipContent side="bottom" className="py-[6px] px-3 max-w-xs">
								<div className="space-y-1">
									<div className="text-[12px] font-medium">
										{lastCommit.author.name}
									</div>
									<div className="text-[11px] opacity-80">
										{lastCommit.author.email}
									</div>
									<div className="text-[11px] opacity-80">
										Hash: {lastCommit.commitHash.substring(0, 8)}
									</div>
									<div className="text-[11px] opacity-80">
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
			header: ({ column }) => (
				<div className="flex justify-center">
					<TableSortButton column={column} headerText="Updated" />
				</div>
			),
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
