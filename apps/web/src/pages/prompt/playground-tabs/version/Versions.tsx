import { Button } from "@/components/ui/button";
import { useParams, useNavigate } from "react-router-dom";
import { promptApi } from "@/api/prompt";

import { useEffect, useMemo, useState, useCallback } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { GitFork, GitCompare, Loader2 } from "lucide-react";
import { capitalizeFirstLetter } from "@/lib/capitalizeFirstLetter";
import CommitTimeline from "@/pages/prompt/playground-tabs/version/CommitTimeline";
import { SearchInput } from "@/components/ui/searchInput";
import CommitDialog from "@/components/dialogs/CommitDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCommitDialog } from "@/hooks/useCommitDialog";

interface Author {
	id: number;
	name: string;
	email: string;
}

interface PromptVersion {
	id: number;
	commitMsg: string;
	commitHash: string;
	createdAt: string;
	author: Author;
}

export interface Branch {
	id: number;
	promptId: number;
	name: string;
	createdAt: string;
	promptVersions: PromptVersion[];
}

export default function Versions() {
	const [branch, setBranch] = useState("");
	const [isCommitted, setIsCommitted] = useState(false);

	const { id, orgId, projectId } = useParams<{
		id: string;
		orgId: string;
		projectId: string;
	}>();
	const navigate = useNavigate();
	const [search, setSearch] = useState("");
	const [data, setData] = useState<{ branches: Branch[] } | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	const fetchBranches = useCallback(async () => {
		if (!id) return;
		setIsLoading(true);
		try {
			const result = await promptApi.getBranches(id);
			const transformed = {
				branches: result.branches.map((branch: any) => ({
					...branch,
					promptVersions: branch.promptVersions.map((version: any) => ({
						...version,
						author: version.author || {
							id: 0,
							name: "Unknown",
							email: "",
						},
					})),
				})),
			} as { branches: Branch[] };
			setData(transformed);
		} catch (error) {
			console.error("Error fetching branches:", error);
		} finally {
			setIsLoading(false);
		}
	}, [id]);

	const fetchPrompt = useCallback(async () => {
		if (!id) return;
		try {
			const result = await promptApi.getPrompt(id);
			if (result?.prompt?.commited !== undefined) {
				setIsCommitted(result.prompt.commited);
			}
		} catch (error) {
			console.error("Error fetching prompt:", error);
		}
	}, [id]);

	useEffect(() => {
		fetchBranches();
		fetchPrompt();
	}, [fetchBranches, fetchPrompt]);



	useEffect(() => {
		if (data?.branches && data.branches.length > 0 && !branch) {
			setBranch(data.branches[0].name);
		}
	}, [data, branch]);

	const {
		isOpen: commitDialogOpen,
		setIsOpen: setCommitDialogOpen,
		value: commitMessage,
		setValue: setCommitMessage,
		isGenerating,
		isCommitting,
		handleGenerate,
		handleCommit,
	} = useCommitDialog({
		promptId: id || "",
		onSuccess: () => {
			setIsCommitted(true);
			fetchPrompt();
			fetchBranches();
		},
	});

	const selectedBranchData = useMemo(() => {
		if (!data?.branches) return [];
		const found = data.branches.find((b: Branch) => b.name === branch);
		if (!found) return [];
		const productiveCommitId =
			found.promptVersions.length > 0 ? found.promptVersions[0].id : null;
		const filteredVersions = found.promptVersions.filter((version: PromptVersion) => {
			const queryLower = search.toLowerCase();
			return (
				version.commitMsg.toLowerCase().includes(queryLower) ||
				version.commitHash.toLowerCase().includes(queryLower)
			);
		});
		return [{ ...found, promptVersions: filteredVersions, productiveCommitId }];
	}, [data, branch, search]);

	const handleCompare = () => {
		if (id && orgId && projectId) {
			navigate(`/${orgId}/${projectId}/prompt/${id}/compare`);
		}
	};

	return (
		<>
			<div className="space-y-4 pt-8 max-w-[1232px] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px] 2xl-plus:w-[70%] ml-3 mr-6 w-full bg-background text-foreground">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="hidden">
							<Select value={branch} onValueChange={setBranch}>
								<SelectTrigger className="w-[125px] h-[36px]">
									<div className="flex items-center gap-1 text-sm">
										<GitFork className="size-4" />
										<span>{capitalizeFirstLetter(branch)}</span>
									</div>
								</SelectTrigger>
								<SelectContent>
									{data?.branches &&
										data.branches.length > 0 &&
										data.branches.map((item: Branch) => (
											<SelectItem
												key={item.id}
												value={item.name}
												className="text-xs [&_svg]:size-4 [&_span]:flex [&_span]:gap-1"
											>
												<GitFork />
												{capitalizeFirstLetter(item.name)}
											</SelectItem>
										))}
								</SelectContent>
							</Select>
						</div>

						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										className="px-7 w-[86px]"
										onClick={() => setCommitDialogOpen(true)}
										disabled={isCommitted}
									>
										Commit
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<p>Save prompt changes</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>

						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="outline"
										className="px-4 h-[36px] flex items-center gap-2"
										onClick={handleCompare}
									>
										<GitCompare className="size-4" />
										Compare
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<p>Compare prompt versions</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</div>

					<div className="flex items-center gap-3">
						<SearchInput
							placeholder="Search..."
							className="min-w-[252px] h-[36px]"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>
				</div>

				{isLoading ? (
					<div className="flex items-center justify-center p-8">
						<Loader2 className="animate-spin" />
					</div>
				) : (
					<CommitTimeline branches={selectedBranchData} />
				)}
			</div>

			<CommitDialog
				open={commitDialogOpen}
				onOpenChange={setCommitDialogOpen}
				value={commitMessage}
				onChange={setCommitMessage}
				onCommit={handleCommit}
				onGenerate={handleGenerate}
				isGenerating={isGenerating}
				isCommitting={isCommitting}
			/>
		</>
	);
}
