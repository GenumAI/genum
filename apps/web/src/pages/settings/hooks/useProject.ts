import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/useToast";
import { projectApi } from "@/api/project";
import { CURRENT_USER_QUERY_KEY } from "@/hooks/useCurrentUser";
import * as z from "zod";
import { getOrgId, getProjectId } from "@/api/client";

export const projectFormSchema = z.object({
	name: z.string().min(1, { message: "Project name is required" }),
	description: z.string().optional(),
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

const PROJECT_QUERY_KEY = ["project"] as const;

export function useProject() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const orgId = getOrgId();
	const projectId = getProjectId();

	const query = useQuery({
		queryKey: [...PROJECT_QUERY_KEY, orgId, projectId],
		queryFn: () => projectApi.getProject(),
		enabled: Boolean(orgId && projectId),
	});

	const mutation = useMutation({
		mutationFn: (values: ProjectFormValues) =>
			projectApi.updateProject({
				name: values.name.trim(),
				description: values.description?.trim() || "",
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [...PROJECT_QUERY_KEY, orgId, projectId] });
			queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
		},
	});

	const updateProject = async (values: ProjectFormValues) => {
		try {
			await mutation.mutateAsync(values);
			toast({ title: "Saved", description: "Project updated" });
			return true;
		} catch (error) {
			console.error(error);
			toast({
				title: "Error",
				description: "Could not update project",
				variant: "destructive",
			});
			return false;
		}
	};

	return {
		project: query.data?.project ?? null,
		isLoading: query.isLoading,
		isSaving: mutation.isPending,
		updateProject,
		refresh: query.refetch,
	};
}
