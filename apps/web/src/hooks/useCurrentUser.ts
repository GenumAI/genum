import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { userApi } from "@/api/user";
import type { CurrentUser } from "@/api/user/user.api";
import { authKeys } from "@/query-keys/auth.keys";

export function useCurrentUser() {
	const { isAuthenticated, isLoading: isLoadingAuth } = useAuth();

	const query = useQuery({
		queryKey: authKeys.currentUser(),
		queryFn: () => userApi.getCurrentUser(),
		enabled: isAuthenticated && !isLoadingAuth,
		staleTime: 1000 * 60 * 5,
	});

	return {
		user: query.data ?? null,
		isLoading: query.isLoading || isLoadingAuth,
		error: query.error,
		refetch: query.refetch,
	};
}

export function useInvalidateCurrentUser() {
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries({ queryKey: authKeys.currentUser() });
}

export function useRemoveCurrentUser() {
	const queryClient = useQueryClient();
	return () => queryClient.removeQueries({ queryKey: authKeys.currentUser() });
}

export function useSetCurrentUser() {
	const queryClient = useQueryClient();
	return (user: CurrentUser) => queryClient.setQueryData(authKeys.currentUser(), user);
}
