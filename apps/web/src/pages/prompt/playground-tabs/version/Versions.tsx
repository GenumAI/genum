import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import CommitTimeline from "@/pages/prompt/playground-tabs/version/components/CommitTimeline";
import CommitDialog from "@/components/dialogs/CommitDialog";
import { useCommitDialog } from "@/hooks/useCommitDialog";
import { getOrgId, getProjectId } from "@/api/client";

import { useVersionsData } from "./hooks/useVersionsData";
import { VersionsToolbar } from "./components/VersionsToolbar";
import type { PromptVersion } from "./utils/types";

export default function Versions() {
	const { id, tab } = useParams<{ id: string; tab: string }>();
	const isActive = tab === "versions";
	const orgId = getOrgId();
	const projectId = getProjectId();
	const navigate = useNavigate();

	const [search, setSearch] = useState("");

	const {
		data,
		isLoading,
		isCommitted,
		refresh,
	} = useVersionsData(id, isActive);

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
			refresh();
		},
	});

	const selectedBranchData = useMemo(() => {
		if (!data?.branches) return [];
		const found = data.branches[0];
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
	}, [data, search]);

	const handleCompare = () => {
		if (id && orgId && projectId) {
			navigate(`/${orgId}/${projectId}/prompt/${id}/compare`);
		}
	};

	return (
		<>
			<div className="w-full max-w-[1232px] space-y-4 bg-background px-3 pt-8 text-foreground lg:pr-6 2xl-plus:w-[70%] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px]">
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
