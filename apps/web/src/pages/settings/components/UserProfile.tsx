import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserProfile } from "../hooks/useUserProfile";
import { useUserFeedback } from "../hooks/useUserFeedback";
import { EditProfileDialog } from "./UserProfile/EditProfileDialog";
import { SendFeedbackDialog } from "./UserProfile/SendFeedbackDialog";
import { CloseAccountDialog } from "./UserProfile/CloseAccountDialog";
import { useAuth } from "@/hooks/useAuth";

export default function UserProfile() {
	const { user: userData, isLoading } = useCurrentUser();
	const { isUpdating, updateName } = useUserProfile();
	const { isSubmitting, submitFeedback } = useUserFeedback();

	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
	const [closeAccountOpen, setCloseAccountOpen] = useState(false);
	const { logout } = useAuth();

	if (isLoading) {
		return (
			<div className="flex items-center justify-center p-6">
				<div className="h-6 w-6 animate-spin text-muted-foreground" />
				<span className="ml-2 text-sm text-muted-foreground">Loading user data...</span>
			</div>
		);
	}

	return (
		<Card className="rounded-md shadow-none w-full">
			<CardHeader className="flex flex-row items-center justify-between max-w-[724px] space-y-0 pb-4">
				<CardTitle className="text-[18px] font-medium leading-[28px] text-foreground">General</CardTitle>
				<EditProfileDialog
					open={editDialogOpen}
					onOpenChange={setEditDialogOpen}
					currentName={userData?.name || ""}
					onSave={updateName}
					isUpdating={isUpdating}
				/>
			</CardHeader>

			<CardContent className="space-y-5 max-w-[724px]">
				<div className="space-y-1.5">
					<Label htmlFor="name" className="text-sm text-foreground">
						Name
					</Label>
					<Input
						id="name"
						placeholder="Name Surname"
						value={userData?.name || ""}
						disabled
						className="bg-muted text-muted-foreground"
					/>
					<p className="text-sm text-muted-foreground">
						The name associated with this account
					</p>
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="email" className="text-sm text-foreground">
						Email address
					</Label>
					<Input
						id="email"
						type="email"
						placeholder="johnsmith@mail.com"
						className="bg-muted text-muted-foreground"
						disabled
						defaultValue={userData?.email || ""}
					/>
					<p className="text-sm text-muted-foreground">
						The email address associated with this account
					</p>
				</div>
			</CardContent>

			<CardHeader className="pt-2 pb-5 max-w-[724px]">
				<CardTitle className="font-medium text-[18px] leading-[28px]">Theme</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2 max-w-[724px]">
				<ModeToggle />
			</CardContent>

			<CardHeader className="pt-2 pb-5 max-w-[724px]">
				<CardTitle className="font-medium text-[18px] leading-[28px]">Security</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2 max-w-[724px]">
				<p className="mb-1 text-sm font-bold text-brand">Coming soon</p>
				<p className="mb-1 text-sm font-bold text-muted-foreground">
					Multi-factor authentication (MFA)
				</p>
				<p className="mb-4 text-sm text-muted-foreground">
					Require an extra security challenge when logging in. If you are unable to pass
					this challenge, you will have the option to recover your account via email.
				</p>
				<Button disabled>Enable MFA</Button>
			</CardContent>

			<CardHeader className="py-2 max-w-[724px]">
				<CardTitle className="font-medium text-[18px] leading-[28px]">
					Help & Feedback
				</CardTitle>
			</CardHeader>
			<CardContent className="max-w-[724px]">
				<p className="mb-4 text-sm text-muted-foreground">
					We value your feedback to improve our platform.
				</p>
				<SendFeedbackDialog
					open={feedbackDialogOpen}
					onOpenChange={setFeedbackDialogOpen}
					onSubmit={submitFeedback}
					isSubmitting={isSubmitting}
				/>
			</CardContent>

			<CardHeader className="py-2 max-w-[724px]">
				<CardTitle className="font-medium text-[18px] leading-[28px] text-destructive">
					Close account
				</CardTitle>
			</CardHeader>
			<CardContent className="max-w-[724px]">
				<p className="mb-4 text-sm text-muted-foreground">
					Closing your account anonymises your profile and deletes your sign-in
					credentials, sessions and personal activity. It is permanent, takes effect
					immediately, and cannot be undone. Work that belongs to an organization stays
					with the organization.
				</p>
				<Button variant="destructive" onClick={() => setCloseAccountOpen(true)}>
					Close my account
				</Button>
			</CardContent>

			<CloseAccountDialog
				open={closeAccountOpen}
				onOpenChange={setCloseAccountOpen}
				// The session outlives nothing: the credentials behind it are gone, so
				// the only correct next screen is the logged-out one.
				onClosed={() => logout()}
			/>
		</Card>
	);
}
