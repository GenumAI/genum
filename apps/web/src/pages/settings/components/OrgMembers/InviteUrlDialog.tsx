import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/useToast";

interface InviteUrlDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	inviteUrl: string;
}

export function InviteUrlDialog({ open, onOpenChange, inviteUrl }: InviteUrlDialogProps) {
	const { toast } = useToast();
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(inviteUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
			toast({
				title: "Copied",
				description: "Invitation link copied to clipboard",
				duration: 3000,
			});
		} catch (error) {
			console.error("Failed to copy:", error);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Invitation Link</DialogTitle>
				</DialogHeader>
				<div className="space-y-4 py-2">
					<div className="space-y-2">
						<Label>Share this link with the invited member</Label>
						<div className="flex gap-2">
							<Input
								value={inviteUrl}
								readOnly
								className="flex-1 font-mono text-sm"
								onClick={(e) => (e.target as HTMLInputElement).select()}
							/>
							<Button
								variant="outline"
								size="icon"
								onClick={handleCopy}
								className="shrink-0"
							>
								{copied ? (
									<CheckIcon className="h-4 w-4 text-green-600" size={16} />
								) : (
									<CopyIcon className="h-4 w-4" size={16} />
								)}
							</Button>
						</div>
						<p className="text-xs text-muted-foreground">
							The invited member can use this link to join the organization.
						</p>
					</div>
				</div>
				<DialogFooter>
					<Button onClick={() => onOpenChange(false)}>Done</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
