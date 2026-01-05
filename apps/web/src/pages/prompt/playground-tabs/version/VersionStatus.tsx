import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import CommitDialog from "@/components/dialogs/CommitDialog";
import LastCommitInfo from "@/components/layout/header/LastCommitInfo";
import { useCommitDialog } from "@/hooks/useCommitDialog";

const VersionStatus = ({
	promptId,
	commited,
	onCommitStatusUpdate,
	onCommitStatusChange,
}: {
	promptId: number;
	commited: boolean;
	promptCommit: string;
	onCommitStatusUpdate?: (callback: (commited: boolean) => void) => void;
	onCommitStatusChange?: (commited: boolean) => void;
}) => {
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
		promptId: promptId,
		onSuccess: async () => {
			if (onCommitStatusChange) onCommitStatusChange(true);
		},
	});

	useEffect(() => {
		if (onCommitStatusUpdate) {
			const updateCommitStatus = (newCommited: boolean) => {
				if (onCommitStatusChange) {
					onCommitStatusChange(newCommited);
				}
			};
			onCommitStatusUpdate(updateCommitStatus);
		}
	}, [onCommitStatusUpdate, onCommitStatusChange]);

	const isCommitted = Boolean(commited);

	return (
		<>
			<div className="flex items-center gap-2">
				<LastCommitInfo promptId={promptId} />
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								className="rounded-md text-[13px] bg-black dark:bg-[#ECECEC] dark:text-primary-foreground hover:bg-gray-800 text-white w-[138px] h-[32px]"
								onClick={() => {
									setCommitDialogOpen(true);
								}}
								disabled={isCommitted || isCommitting}
							>
								{isCommitting ? "Committing..." : "Commit"}
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Save prompt changes</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
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
};

export default VersionStatus;
