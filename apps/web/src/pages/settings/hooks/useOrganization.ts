import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/useToast";
import { organizationApi } from "@/api/organization";
import * as z from "zod";
import { authKeys } from "@/query-keys/auth.keys";
import { organizationKeys } from "@/query-keys/organization.keys";

export const organizationFormSchema = z.object({
	name: z.string().min(1, { message: "Organization name is required" }),
	description: z.string().optional(),
});

export type OrganizationFormValues = z.infer<typeof organizationFormSchema>;

export function useOrganization() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const { orgId } = useParams<{ orgId: string }>();

	const query = useQuery({
		queryKey: organizationKeys.byId(orgId),
		queryFn: () => organizationApi.getOrganization(),
		enabled: Boolean(orgId),
	});

	const mutation = useMutation({
		mutationFn: (values: OrganizationFormValues) =>
			organizationApi.updateOrganization({
				name: values.name.trim(),
				description: values.description?.trim() || "",
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: organizationKeys.byId(orgId) });
			queryClient.invalidateQueries({ queryKey: authKeys.currentUser() });
		},
	});

	const updateOrganization = async (values: OrganizationFormValues) => {
		try {
			await mutation.mutateAsync(values);
			toast({
				title: "Success",
				description: "Organization details updated successfully",
			});
			return true;
		} catch (error) {
			console.error("Error updating organization:", error);
			toast({
				title: "Error",
				description: "Failed to update organization details",
				variant: "destructive",
			});
			return false;
		}
	};

	return {
		organization: query.data?.organization ?? null,
		isLoading: query.isLoading,
		isSaving: mutation.isPending,
		updateOrganization,
		refresh: query.refetch,
	};
}
