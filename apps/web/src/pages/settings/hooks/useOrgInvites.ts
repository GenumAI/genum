import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/useToast";
import { organizationApi, type Invite } from "@/api/organization";

export const ORG_INVITES_QUERY_KEY = ["org", "invites"] as const;

export function useOrgInvites(orgId: string | undefined) {
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const query = useQuery({
		queryKey: [...ORG_INVITES_QUERY_KEY, orgId],
		queryFn: () => organizationApi.getInvites(),
		enabled: Boolean(orgId),
		refetchOnMount: "always",
	});

	const deleteMutation = useMutation({
		mutationFn: (invite: Invite) => organizationApi.deleteInvite(invite.token),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [...ORG_INVITES_QUERY_KEY, orgId] });
		},
	});

	const invites = (query.data?.invites ?? []) as Invite[];

	const deleteInvite = async (invite: Invite) => {
		try {
			await deleteMutation.mutateAsync(invite);
			toast({ title: "Success", description: "Invite deleted successfully" });
		} catch (error) {
			console.error(error);
			toast({
				title: "Error",
				description: "Failed to delete invite",
				variant: "destructive",
			});
		}
	};

	const deletingIds = new Set<number>(
		deleteMutation.isPending && deleteMutation.variables ? [deleteMutation.variables.id] : [],
	);

	return {
		invites,
		isLoading: query.isLoading,
		deletingIds,
		deleteInvite,
		refresh: query.refetch,
	};
}
