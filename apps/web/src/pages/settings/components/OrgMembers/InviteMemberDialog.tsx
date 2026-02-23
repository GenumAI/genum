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
import {
	Select,
	SelectTrigger,
	SelectContent,
	SelectValue,
	SelectItem,
} from "@/components/ui/select";
import { InviteUrlDialog } from "./InviteUrlDialog";
import { isLocalAuth } from "@/lib/auth";
import { OrganizationRole } from "@/api/organization";
import type { InviteMemberDialogProps } from "../../utils/types";

export function InviteMemberDialog({
	open,
	onOpenChange,
	onInvite,
	isInviting,
}: InviteMemberDialogProps) {
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<OrganizationRole>(OrganizationRole.ADMIN);
	const [inviteUrlDialogOpen, setInviteUrlDialogOpen] = useState(false);
	const [inviteUrl, setInviteUrl] = useState<string>("");

	const handleInvite = async () => {
		const result = await onInvite(email, role);
		if (result.success) {
			setEmail("");
			setRole(OrganizationRole.ADMIN);
			onOpenChange(false);
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
						</div>
						<div className="space-y-2">
							<Label>Role</Label>
						<Select
							value={role}
							onValueChange={(value) => setRole(value as OrganizationRole)}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select role..." />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={OrganizationRole.ADMIN}>Admin</SelectItem>
								<SelectItem value={OrganizationRole.READER}>Reader</SelectItem>
							</SelectContent>
						</Select>
							<p className="text-xs text-muted-foreground">
								Admins have access to all projects and settings. Readers must be
								added to individual projects.
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
