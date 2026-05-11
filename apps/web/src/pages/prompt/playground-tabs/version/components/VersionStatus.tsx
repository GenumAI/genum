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
		onSuccess: async (commited) => {
			if (onCommitStatusChange) onCommitStatusChange(commited);
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
								className="h-[32px] w-[138px] rounded-md bg-primary text-[13px] text-primary-foreground hover:bg-primary/90"
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
