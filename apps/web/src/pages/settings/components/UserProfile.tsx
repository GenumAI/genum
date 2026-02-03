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

export default function UserProfile() {
	const { user: userData, isLoading } = useCurrentUser();
	const { isUpdating, updateName } = useUserProfile();
	const { isSubmitting, submitFeedback } = useUserFeedback();

	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center p-6">
				<div className="h-6 w-6 animate-spin text-gray-500" />
				<span className="ml-2 text-sm text-gray-500">Loading user data...</span>
			</div>
		);
	}

	return (
		<Card className="rounded-md shadow-none w-full">
			<CardHeader className="flex flex-row items-center justify-between max-w-[724px] space-y-0 pb-4">
				<CardTitle className="font-medium text-[18px] dark:text-[#fff] leading-[28px]">
					General
				</CardTitle>
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
					<Label htmlFor="name" className="text-sm text-[#18181B] dark:text-[#FAFAFA]">
						Name
					</Label>
					<Input
						id="name"
						placeholder="Name Surname"
						value={userData?.name || ""}
						disabled
						className="bg-[#F4F4F5] text-zinc-500"
					/>
					<p className="text-sm text-muted-foreground">
						The name associated with this account
					</p>
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="email" className="text-sm text-[#18181B] dark:text-[#FAFAFA]">
						Email address
					</Label>
					<Input
						id="email"
						type="email"
						placeholder="johnsmith@mail.com"
						className="bg-[#F4F4F5] text-zinc-500"
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
				<p className="text-sm font-bold text-[#437BEF] mb-1">Coming soon</p>
				<p className="text-sm font-bold text-zinc-500 mb-1">
					Multi-factor authentication (MFA)
				</p>
				<p className="text-sm text-zinc-500 mb-4">
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
				<p className="text-sm text-zinc-500 mb-4">
					We value your feedback to improve our platform.
				</p>
				<SendFeedbackDialog
					open={feedbackDialogOpen}
					onOpenChange={setFeedbackDialogOpen}
					onSubmit={submitFeedback}
					isSubmitting={isSubmitting}
				/>
			</CardContent>
		</Card>
	);
}
