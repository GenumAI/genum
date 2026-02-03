import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PlusCircleIcon } from "@phosphor-icons/react";
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
import { Textarea } from "@/components/ui/textarea";
import type { CreateProjectDialogProps } from "../../utils/types";

const projectFormSchema = z.object({
	name: z.string().min(1, { message: "Project name is required" }),
	description: z.string().optional(),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

export function CreateProjectDialog({
	open,
	onOpenChange,
	onCreate,
	isCreating,
}: CreateProjectDialogProps) {
	const {
		register,
		handleSubmit,
		formState: { errors },
		reset,
	} = useForm<ProjectFormValues>({
		resolver: zodResolver(projectFormSchema),
		defaultValues: {
			name: "",
			description: "",
		},
	});

	const onSubmit = async (values: ProjectFormValues) => {
		const success = await onCreate(values);
		if (success) {
			reset();
			onOpenChange(false);
		}
	};

	// Reset form when dialog closes
	useEffect(() => {
		if (!open) {
			reset();
		}
	}, [open, reset]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>
				<Button size="default" className="[&_svg]:size-6">
					<PlusCircleIcon />
					Create Project
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create New Project</DialogTitle>
				</DialogHeader>
				<form onSubmit={handleSubmit(onSubmit)}>
					<div className="flex flex-col gap-3 py-2">
						<div>
							<Label htmlFor="project-name">Project Name</Label>
							<Input
								id="project-name"
								{...register("name")}
								placeholder="Awesome project"
							/>
							{errors.name && (
								<p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
							)}
						</div>
						<div>
							<Label className="mt-3" htmlFor="project-description">
								Description
							</Label>
							<Textarea
								id="project-description"
								rows={4}
								{...register("description")}
								placeholder="Enter project description"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={isCreating}>
							{isCreating ? "Creating..." : "Create"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
