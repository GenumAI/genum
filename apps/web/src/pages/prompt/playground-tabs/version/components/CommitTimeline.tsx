import clsx from "clsx";
import { Link, useLocation } from "react-router-dom";
import { GitCommitHorizontal } from "lucide-react";
import { EmptyState } from "@/pages/info-pages/EmptyState";
import { formatUserLocalDateTime } from "@/lib/formatUserLocalDateTime";
import type { Branch, PromptVersion } from "../utils/types";

const LETTER_COLOR_MAP: Record<string, string> = {
	A: "bg-[#D6CFFF]",
	B: "bg-[#BBCAFF]",
	C: "bg-[#BFDEFF]",
	D: "bg-[#D5F0FF]",
	E: "bg-[#D7EFEB]",
	F: "bg-[#D6F6E6]",
	G: "bg-[#DEEADE]",
	H: "bg-[#E7F5C8]",
	I: "bg-[#FFE4F2]",
	J: "bg-[#FFD7D8]",
	K: "bg-[#FFE6B1]",
	L: "bg-[#F9ECDB]",
	M: "bg-[#D6CFFF]",
	N: "bg-[#BBCAFF]",
	O: "bg-[#BFDEFF]",
	P: "bg-[#D5F0FF]",
	Q: "bg-[#D7EFEB]",
	R: "bg-[#D6F6E6]",
	S: "bg-[#DEEADE]",
	T: "bg-[#E7F5C8]",
	U: "bg-[#FFE4F2]",
	V: "bg-[#FFD7D8]",
	W: "bg-[#FFE6B1]",
	X: "bg-[#F9ECDB]",
	Y: "bg-[#D6CFFF]",
	Z: "bg-[#BBCAFF]",
};

const getColorByFirstLetter = (name: string): string => {
	const firstLetter = name?.[0]?.toUpperCase() || "A";
	return LETTER_COLOR_MAP[firstLetter] || "bg-[#D6CFFF]";
};

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
								const authorBg = getColorByFirstLetter(version.author.name);
								return (
									<div
										key={version.id}
										className="flex items-start gap-4 relative py-3 pl-4 border-b border-border hover:bg-muted/60 transition-colors"
									>
										<div
											className={clsx(
												"w-8 h-8 rounded-md flex items-center justify-center font-semibold",
												"text-slate-800 dark:text-slate-900",
												authorBg,
											)}
										>
											{version.author.name[0]?.toUpperCase() || "S"}
										</div>

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
												</Link>

												<div className="flex items-center gap-2">
													<span className="w-28">
														{productiveCommitId &&
															version.id === productiveCommitId && (
																<span className="border border-green-600/40 text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 text-[12px] font-semibold px-3 py-[2px] rounded">
																	productive
																</span>
															)}
													</span>

													<div className="w-28 flex items-center justify-center">
														<div className="flex items-center w-fit text-[12px] dark:bg-[#27272a] dark:border-[#3a3a3a] dark:text-[#fff] rounded-sm border border-border px-2 py-0 font-semibold text-foreground">
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
