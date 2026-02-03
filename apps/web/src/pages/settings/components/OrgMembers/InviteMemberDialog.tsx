import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InviteUrlDialog } from "./InviteUrlDialog";
import { isLocalAuth } from "@/lib/auth";
import type { InviteMemberDialogProps } from "../../utils/types";

export function InviteMemberDialog({
	open,
	onOpenChange,
	onInvite,
	isInviting,
}: InviteMemberDialogProps) {
	const [email, setEmail] = useState("");
	const [inviteUrlDialogOpen, setInviteUrlDialogOpen] = useState(false);
	const [inviteUrl, setInviteUrl] = useState<string>("");

	const handleInvite = async () => {
		const result = await onInvite(email);
		if (result.success) {
			setEmail("");
			onOpenChange(false);
			// For local instance, show invite URL dialog
			if (isLocalAuth() && result.inviteUrl) {
				setInviteUrl(result.inviteUrl);
				setInviteUrlDialogOpen(true);
			}
		}
	};

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogTrigger asChild>
					<Button className="min-w-[175px]">
						<PlusCircle className="mr-2 h-4 w-4" /> Add Member
					</Button>
				</DialogTrigger>
				<DialogContent className="sm:max-w-[420px]">
					<DialogHeader>
						<DialogTitle>Invite Member</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-2">
						<div className="space-y-2">
							<Label>Email</Label>
							<Input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="name@example.com"
							/>
							<p className="text-xs text-muted-foreground">
								At the moment, all team members will have admin permissions.
							</p>
						</div>
					</div>
					<DialogFooter>
						<Button onClick={handleInvite} disabled={isInviting || !email.trim()}>
							Send Invite
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{isLocalAuth() && (
				<InviteUrlDialog
					open={inviteUrlDialogOpen}
					onOpenChange={setInviteUrlDialogOpen}
					inviteUrl={inviteUrl}
				/>
			)}
		</>
	);
}
