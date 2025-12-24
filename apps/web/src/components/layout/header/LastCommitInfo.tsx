import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { promptApi } from "@/api/prompt";

interface LastCommitInfoProps {
	promptId: number;
}

type BranchesData = {
	branches: Array<{
		id: number;
		promptId: number;
		name: string;
		createdAt: string;
		promptVersions: Array<{
			id: number;
			commitMsg: string;
			commitHash: string;
			createdAt: string;
			author: {
				id: number;
				name: string;
				email: string;
				picture: string;
			};
		}>;
	}>;
};

const LastCommitInfo = ({ promptId }: LastCommitInfoProps) => {
	const [data, setData] = useState<BranchesData | null>(null);

	useEffect(() => {
		const fetchBranches = async () => {
			if (!promptId) return;
			try {
				const result = await promptApi.getBranches(promptId);
				const branchesData: BranchesData = {
					branches: result.branches.map((branch) => ({
						...branch,
						promptVersions: branch.promptVersions.map((version) => ({
							...version,
							author: version.author || {
								id: 0,
								name: "Unknown",
								email: "",
								picture: "",
							},
						})),
					})),
				};
				setData(branchesData);
			} catch (error) {
				console.error("❌ Failed to fetch branches:", error);
			}
		};

		fetchBranches();
	}, [promptId]);

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

	const getLatestCommit = (): BranchesData["branches"][0]["promptVersions"][0] | null => {
		if (!data?.branches) return null;

		let latestCommit: BranchesData["branches"][0]["promptVersions"][0] | null = null;

		data.branches.forEach((branch) => {
			branch.promptVersions.forEach((version) => {
				if (!latestCommit) {
					latestCommit = version;
				} else {
					const versionDate = new Date(version.createdAt);
					const latestDate = new Date(latestCommit.createdAt);
					if (versionDate > latestDate) {
						latestCommit = version;
					}
				}
			});
		});

		return latestCommit;
	};

	const latestCommit = getLatestCommit();

	if (!latestCommit) {
		return null;
	}

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
				<TooltipContent className="max-w-sm">
					<div className="space-y-2">
						<p className="font-medium text-[#FFFFFF]">
							{formatTooltipDate(latestCommit.createdAt)}
						</p>
						<div className="space-y-1">
							<p className="text-xs text-[#FFFFFF] whitespace-pre-wrap">
								{latestCommit.commitMsg}
							</p>
						</div>
						<div className="flex items-center gap-2 pt-1">
							<Avatar className="h-5 w-5">
								<AvatarImage
									src={latestCommit.author.picture}
									alt={latestCommit.author.name}
								/>
								<AvatarFallback className="text-[10px]">
									{latestCommit.author.name[0]?.toUpperCase() || "U"}
								</AvatarFallback>
							</Avatar>
							<span className="text-xs text-[#FFFFFF]">
								{latestCommit.author.name}
							</span>
						</div>
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
};

export default LastCommitInfo;
