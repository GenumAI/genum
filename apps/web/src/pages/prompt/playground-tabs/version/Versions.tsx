import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

import CommitTimeline from "@/pages/prompt/playground-tabs/version/components/CommitTimeline";
import CommitDialog from "@/components/dialogs/CommitDialog";
import { useCommitDialog } from "@/hooks/useCommitDialog";

import { useVersionsData } from "./hooks/useVersionsData";
import { VersionsToolbar } from "./components/VersionsToolbar";
import type { Branch, PromptVersion } from "./utils/types";

export default function Versions() {
	const { id, orgId, projectId } = useParams<{
		id: string;
		orgId: string;
		projectId: string;
	}>();
	const navigate = useNavigate();

	const [branch, setBranch] = useState("");
	const [search, setSearch] = useState("");

	const {
		data,
		isLoading,
		isCommitted,
		setIsCommitted,
		refresh,
	} = useVersionsData(id);

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
			refresh();
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
				<VersionsToolbar
					onCommitClick={() => setCommitDialogOpen(true)}
					onCompareClick={handleCompare}
					isCommitDisabled={isCommitted}
					searchValue={search}
					onSearchChange={setSearch}
				/>

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
