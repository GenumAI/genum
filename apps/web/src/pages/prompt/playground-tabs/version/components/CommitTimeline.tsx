import clsx from "clsx";
import { Link, useLocation } from "react-router-dom";
import { GitCommitHorizontal } from "lucide-react";
import { EmptyState } from "@/pages/info-pages/EmptyState";
import { formatUserLocalDateTime } from "@/lib/formatUserLocalDateTime";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { isCloudAuth } from "@/lib/auth";
import { getAvatarColor, getAvatarInitial } from "@/lib/avatarUtils";
import { CommitAuthorAvatar } from "@/pages/prompt/utils/CommitAuthorAvatar";
import { CommitPlaceholders } from "./CommitPlaceholders";
import type { Branch, PromptVersion } from "../utils/types";

interface GroupedCommits {
	date: string;
	commits: PromptVersion[];
}

type CommitTimelineProps = {
	branches: Branch[];
};

function groupCommitsByDate(branches: Branch[]): GroupedCommits[] {
	if (!branches) return [];

	const allCommits: PromptVersion[] = [];
	branches.forEach((branch) => {
		if (branch.promptVersions) {
			allCommits.push(...branch.promptVersions);
		}
	});

	allCommits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

	const grouped = allCommits.reduce((acc, commit) => {
		const date = formatUserLocalDateTime(commit.createdAt);

		const existing = acc.find((group) => group.date === date);
		if (existing) {
			existing.commits.push(commit);
		} else {
			acc.push({ date, commits: [commit] });
		}

		return acc;
	}, [] as GroupedCommits[]);

	return grouped;
}

export default function CommitTimeline({ branches }: CommitTimelineProps) {
	const location = useLocation();
	const isCloud = isCloudAuth();

	const productiveCommitId =
		branches && branches.length > 0 && "productiveCommitId" in branches[0]
			? (branches[0] as Branch & { productiveCommitId?: number }).productiveCommitId
			: null;

	const hasBranches = branches && branches.length > 0;
	const hasAnyVersions =
		hasBranches &&
		branches.some((branch) => branch.promptVersions && branch.promptVersions.length > 0);

	if (!hasBranches) {
		return <EmptyState title="No commits found" description="Create a new commit to start." />;
	}

	if (!hasAnyVersions) {
		return (
			<EmptyState
				title="No commits found"
				description="Make your first commit to get started."
			/>
		);
	}

	function formatTimeAgo(dateString: string): string {
		const diffMs = Date.now() - new Date(dateString).getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

		if (diffDays > 0) {
			return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
		} else if (diffHours > 0) {
			return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
		} else {
			return "just now";
		}
	}

	const groupedCommits = groupCommitsByDate(branches);

	return (
		<div className="p-1 py-4">
			{groupedCommits.map((group, groupIndex) => {
				const isLastGroup = groupIndex === groupedCommits.length - 1;

				return (
					<div key={group.date} className="relative">
						<div className="flex justify-between">
							<div className="flex items-center gap-2">
								<GitCommitHorizontal className="w-7 h-7 text-foreground" />
								<div className="text-sm text-muted-foreground font-medium">
									{group.date}
								</div>
							</div>

							{groupIndex < 1 && (
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<span className="w-7" />
										<span />
									</div>
									<div className="flex gap-2 text-sm text-muted-foreground">
										<span className="w-28" />
										<span className="w-28 flex items-center justify-center">
											Commit Hash
										</span>
									</div>
								</div>
							)}
						</div>

						<div
							className={clsx(
								"border-l-2 border-border ml-3 pl-4 py-3",
								isLastGroup ? "pb-0" : "pb-4",
							)}
						>
							{group.commits.map((version) => {
								const authorName = version.author.name;
								const cloudAvatarUrl =
									version.author.avatar || version.author.picture;
								const authorInitial = getAvatarInitial(authorName);
								const authorColor = getAvatarColor(authorName);
								return (
									<div
										key={version.id}
										className="flex items-start gap-4 relative py-3 pl-4 border-b border-border hover:bg-muted/60 transition-colors"
									>
										{isCloud ? (
											<Avatar className="h-8 w-8 rounded-md">
												<AvatarImage
													src={cloudAvatarUrl}
													alt={authorName}
												/>
												<AvatarFallback
													className={`rounded-md font-bold text-[18px] ${authorColor}`}
												>
													{authorInitial}
												</AvatarFallback>
											</Avatar>
										) : (
											<CommitAuthorAvatar
												author={version.author}
												size="h-8 w-8"
												textSize="text-[18px]"
												rounded="rounded-md"
											/>
										)}

										<div className="flex-1">
											<div className="flex justify-between items-center">
												<Link
													to={`${location.pathname}/${version.id}`}
													className="w-full"
												>
													<p className="text-sm font-semibold leading-5 text-foreground">
														{version.commitMsg}
													</p>
													<p className="text-sm text-muted-foreground leading-5">
														{version.author.name} authored{" "}
														{formatTimeAgo(version.createdAt)}
													</p>
													<CommitPlaceholders
														snapshot={version.placeholders}
													/>
												</Link>

												<div className="flex items-center gap-2">
													<span className="w-28">
														{productiveCommitId &&
															version.id === productiveCommitId && (
																<span className="rounded border border-success/40 bg-success-soft text-[12px] font-semibold text-success px-3 py-[2px]">
																	productive
																</span>
															)}
													</span>

													<div className="w-28 flex items-center justify-center">
														<div className="flex w-fit items-center rounded-sm border border-border bg-card px-2 py-0 text-[12px] font-semibold text-foreground">
															<span>
																{version.commitHash.substring(0, 8)}
															</span>
														</div>
													</div>
												</div>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				);
			})}
		</div>
	);
}
