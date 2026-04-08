import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { isCloudAuth } from "@/lib/auth";
import { getAvatarColor, getAvatarInitial } from "@/lib/avatarUtils";
import { CommitAuthorAvatar } from "@/pages/prompt/utils/CommitAuthorAvatar";
import { promptApi } from "@/api/prompt";
import { versionKeys } from "@/query-keys/version.keys";
import type {
	BranchesResponse,
	PromptVersion,
} from "@/pages/prompt/playground-tabs/version/utils/types";

interface LastCommitInfoProps {
	promptId: number;
}

const FALLBACK_AUTHOR = {
	id: 0,
	name: "Unknown",
	email: "",
	picture: "",
};

const LastCommitInfo = ({ promptId }: LastCommitInfoProps) => {
	const isCloud = isCloudAuth();
	const { data } = useQuery<BranchesResponse>({
		queryKey: versionKeys.versions(promptId),
		queryFn: async () => {
			const result = await promptApi.getBranches(promptId);
			return {
				branches: result.branches.map((branch) => ({
					...branch,
					promptVersions: branch.promptVersions.map((version) => ({
						...version,
						author: version.author || FALLBACK_AUTHOR,
					})),
				})),
			};
		},
		enabled: Boolean(promptId),
		staleTime: Infinity,
		gcTime: Infinity,
	});

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		const now = new Date();
		const diffTime = now.getTime() - date.getTime();
		const diffSeconds = Math.floor(diffTime / 1000);
		const diffMinutes = Math.floor(diffTime / (1000 * 60));
		const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
		const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

		if (diffSeconds < 60) {
			return "Just Now";
		} else if (diffMinutes < 60) {
			return `${diffMinutes} min ago`;
		} else if (diffHours < 24) {
			return `${diffHours}h ago`;
		} else if (diffDays === 1) {
			return "1 day ago";
		} else {
			return `${diffDays} days ago`;
		}
	};

	const formatTooltipDate = (dateString: string) => {
		const date = new Date(dateString);
		const day = String(date.getDate()).padStart(2, "0");
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const year = date.getFullYear();
		const hours = String(date.getHours()).padStart(2, "0");
		const minutes = String(date.getMinutes()).padStart(2, "0");
		const seconds = String(date.getSeconds()).padStart(2, "0");

		return `${day}.${month}.${year}, ${hours}:${minutes}:${seconds}`;
	};

	const latestCommit = useMemo(() => {
		if (!data?.branches) return null;

		let latest: PromptVersion | null = null;
		for (const branch of data.branches) {
			for (const version of branch.promptVersions) {
				if (!latest || new Date(version.createdAt) > new Date(latest.createdAt)) {
					latest = version;
				}
			}
		}
		return latest;
	}, [data]);

	if (!latestCommit) {
		return null;
	}

	const author = latestCommit.author;
	const cloudAuthorAvatarUrl = author.avatar || author.picture;
	const authorInitial = getAvatarInitial(author.name);
	const authorColor = getAvatarColor(author.name);

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<div className="flex items-center gap-2 cursor-pointer mr-4">
						<Clock className="w-4 h-4 text-muted-foreground" />
						<div className="flex flex-col">
							<span className="text-[12px] text-muted-foreground leading-tight">
								Last commit
							</span>
							<span className="text-[12px] text-muted-foreground leading-tight">
								{formatDate(latestCommit.createdAt)}
							</span>
						</div>
					</div>
				</TooltipTrigger>
				<TooltipContent showArrow={false} className="max-w-sm border border-border">
					<div className="space-y-2">
						<p className="font-medium">{formatTooltipDate(latestCommit.createdAt)}</p>
						<div className="space-y-1">
							<p className="text-xs whitespace-pre-wrap">{latestCommit.commitMsg}</p>
						</div>
						<div className="flex items-center gap-2 pt-1">
							{isCloud ? (
								<Avatar className="h-5 w-5">
									<AvatarImage src={cloudAuthorAvatarUrl} alt={author.name} />
									<AvatarFallback
										className={`text-[10px] font-semibold ${authorColor}`}
									>
										{authorInitial}
									</AvatarFallback>
								</Avatar>
							) : (
								<CommitAuthorAvatar author={author} />
							)}
							<span className="text-xs">{author.name}</span>
						</div>
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
};

export default LastCommitInfo;
