import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { DeleteProviderDialogProps } from "../../utils/types";

export function DeleteProviderDialog({
	open,
	onOpenChange,
	onConfirm,
	deleteStatus,
	deleteStatusError,
	isCheckingDeleteStatus,
	isDeletingProvider,
	buildPromptHref,
}: DeleteProviderDialogProps) {
	const isDeleteBlocked = Boolean(deleteStatus && !deleteStatus.canDelete);
	const isDeleteDisabled =
		isDeletingProvider || isCheckingDeleteStatus || Boolean(deleteStatusError) || isDeleteBlocked;

	const handleConfirm = async () => {
		await onConfirm();
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Delete Custom Provider</DialogTitle>
					<DialogDescription>
						{isCheckingDeleteStatus
							? "Checking if this provider can be deleted..."
							: isDeleteBlocked
								? "Provider is in use. See details below."
								: "Deleting the provider will have the following effects:"}
					</DialogDescription>
				</DialogHeader>

				{deleteStatusError && <p className="text-sm text-red-600">{deleteStatusError}</p>}

				{isCheckingDeleteStatus && (
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						<span>Checking usage...</span>
					</div>
				)}

				{isDeleteBlocked && deleteStatus && (
					<div className="space-y-3 text-sm">
						<p className="text-muted-foreground">Deletion is blocked by the prompts below.</p>
						{deleteStatus.promptUsagePrompts.length > 0 && (
							<div className="space-y-2">
								<p className="text-muted-foreground font-medium">
									Prompts using provider models
								</p>
								<ul className="space-y-1">
									{deleteStatus.promptUsagePrompts.map((prompt) => (
										<li key={`prompt-usage-${prompt.id}`} className="flex items-center gap-2">
											<Link
												to={buildPromptHref(prompt.id)}
												target="_blank"
												rel="noreferrer"
												className="text-primary hover:underline"
											>
												{prompt.name}
											</Link>
											<span className="text-muted-foreground/70">({prompt.id})</span>
										</li>
									))}
								</ul>
							</div>
						)}
						{deleteStatus.productiveCommitUsagePrompts.length > 0 && (
							<div className="space-y-2">
								<p className="text-muted-foreground font-medium">
									Prompts with productive commits using custom models
								</p>
								<ul className="space-y-1">
									{deleteStatus.productiveCommitUsagePrompts.map((prompt) => (
										<li
											key={`productive-usage-${prompt.id}`}
											className="flex items-center gap-2"
										>
											<Link
												to={buildPromptHref(prompt.id)}
												target="_blank"
												rel="noreferrer"
												className="text-primary hover:underline"
											>
												{prompt.name}
											</Link>
											<span className="text-muted-foreground/70">({prompt.id})</span>
										</li>
									))}
								</ul>
							</div>
						)}
					</div>
				)}

				{!isDeleteBlocked && (
					<p className="text-sm text-muted-foreground">
						This action is irreversible. All synced models will be deleted.
					</p>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeletingProvider}>
						Cancel
					</Button>
					<Button
						onClick={handleConfirm}
						disabled={isDeleteDisabled}
						className="bg-red-600 hover:bg-red-700 text-white"
					>
						{isDeletingProvider ? "Deleting..." : "Delete Provider"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
