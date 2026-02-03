import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { projectFormSchema, type ProjectFormValues } from "../../hooks/useProject";
import type { EditProjectDialogProps } from "../../utils/types";

export function EditProjectDialog({
	open,
	onOpenChange,
	project,
	onSuccess,
}: EditProjectDialogProps) {
	const [isSaving, setIsSaving] = useState(false);

	const form = useForm<ProjectFormValues>({
		resolver: zodResolver(projectFormSchema),
		defaultValues: {
			name: project.name,
			description: project.description || "",
		},
	});

	const onSubmit = async (values: ProjectFormValues) => {
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
					<DialogTitle>Edit Project</DialogTitle>
				</DialogHeader>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
					<div className="space-y-1">
						<Label htmlFor="project-name">Name</Label>
						<Input
							id="project-name"
							{...form.register("name")}
							placeholder="Enter project name"
						/>
						{form.formState.errors.name && (
							<p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
						)}
					</div>
					<div className="space-y-1">
						<Label htmlFor="project-description">Description</Label>
						<Textarea
							id="project-description"
							rows={4}
							{...form.register("description")}
							placeholder="Enter project description"
						/>
						{form.formState.errors.description && (
							<p className="text-sm text-red-500">
								{form.formState.errors.description.message}
							</p>
						)}
					</div>
					<DialogFooter className="gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isSaving}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isSaving || !form.formState.isValid}>
							{isSaving ? "Saving..." : "Save changes"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
