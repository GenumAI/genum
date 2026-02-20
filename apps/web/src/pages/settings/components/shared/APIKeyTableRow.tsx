import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableRow, TableCell } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDate, formatFullDate, formatAPIKey } from "../../utils/formatters";
import { getAvatarColor, getAvatarInitial, getAvatarUrl } from "@/lib/avatarUtils";
import type { APIKeyTableRowProps } from "../../utils/types";

export function APIKeyTableRow({
	keyData,
	onDelete,
	showProject = false,
	isDeleting = false,
}: APIKeyTableRowProps) {
	const authorName = keyData.author?.name || "Unknown";
	const authorAvatar = getAvatarUrl(keyData.author);
	const authorInitial = getAvatarInitial(authorName);
	const authorColor = getAvatarColor(authorName);

	return (
		<TableRow>
			{showProject && keyData.project && (
				<TableCell className="px-4 py-3 text-center">
					<div className="font-medium">{keyData.project.name}</div>
				</TableCell>
			)}
			<TableCell className="px-4 py-3 text-center">
				<div className="font-medium">{keyData.name}</div>
			</TableCell>
			<TableCell className="px-4 py-3 text-center">
				<code className="font-mono text-sm">{formatAPIKey(keyData.publicKey)}</code>
			</TableCell>
			<TableCell className="px-4 py-3 text-center">
				<div className="flex items-center justify-center gap-2">
					<Avatar className="h-6 w-6 rounded-lg">
						<AvatarImage
							src={authorAvatar}
							alt={authorName}
						/>
						<AvatarFallback className={`rounded-lg text-xs font-bold ${authorColor}`}>
							{authorInitial}
						</AvatarFallback>
					</Avatar>
					<span className="text-sm">{authorName}</span>
				</div>
			</TableCell>
			<TableCell className="px-4 py-3 text-center">
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<span className="text-sm cursor-help">
								{formatDate(keyData.createdAt)}
							</span>
						</TooltipTrigger>
						<TooltipContent>
							<p>{formatFullDate(keyData.createdAt)}</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</TableCell>
			<TableCell className="px-4 py-3 text-center">
				{keyData.lastUsed ? (
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="text-sm cursor-help">
									{formatDate(keyData.lastUsed)}
								</span>
							</TooltipTrigger>
							<TooltipContent>
								<p>{formatFullDate(keyData.lastUsed)}</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				) : (
					<span className="text-sm text-muted-foreground">Never</span>
				)}
			</TableCell>
			<TableCell className="text-center px-4 py-3">
				<div className="flex gap-1 justify-center">
					<Button
						variant="ghost"
						size="sm"
						onClick={onDelete}
						disabled={isDeleting}
						className="h-8 w-8 p-0"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>
			</TableCell>
		</TableRow>
	);
}
