import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { organizationFormSchema, type OrganizationFormValues } from "../../hooks/useOrganization";
import type { EditOrgDialogProps } from "../../utils/types";

export function EditOrgDialog({ open, onOpenChange, organization, onSuccess }: EditOrgDialogProps) {
	const [isSaving, setIsSaving] = useState(false);

	const form = useForm<OrganizationFormValues>({
		resolver: zodResolver(organizationFormSchema),
		defaultValues: {
			name: organization.name,
			description: organization.description || "",
		},
	});

	const onSubmit = async (values: OrganizationFormValues) => {
		setIsSaving(true);
		const success = await onSuccess(values);
		setIsSaving(false);

		if (success) {
			onOpenChange(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Edit Organization</DialogTitle>
				</DialogHeader>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
					<div className="space-y-1">
						<Label htmlFor="edit-name">Organization Name</Label>
						<Input
							id="edit-name"
							{...form.register("name")}
							placeholder="Enter organization name"
						/>
						{form.formState.errors.name && (
							<p className="text-sm text-red-500">
								{form.formState.errors.name.message}
							</p>
						)}
					</div>
					<div className="space-y-1">
						<Label htmlFor="edit-description">Description</Label>
						<Textarea
							id="edit-description"
							rows={4}
							{...form.register("description")}
							placeholder="Enter organization description"
						/>
						{form.formState.errors.description && (
							<p className="text-sm text-red-500">
								{form.formState.errors.description.message}
							</p>
						)}
					</div>
					<DialogFooter className="gap-2 pt-4">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isSaving}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isSaving || !form.formState.isValid}>
							{isSaving ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Saving...
								</>
							) : (
								"Save changes"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
