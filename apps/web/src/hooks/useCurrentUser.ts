import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { userApi } from "@/api/user";
import type { CurrentUser } from "@/api/user/user.api";

export const CURRENT_USER_QUERY_KEY = ["currentUser"] as const;

export function useCurrentUser() {
	const { isAuthenticated, isLoading: isLoadingAuth } = useAuth();

	const query = useQuery({
		queryKey: CURRENT_USER_QUERY_KEY,
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
	return () => queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
}

export function useRemoveCurrentUser() {
	const queryClient = useQueryClient();
	return () => queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY });
}

export function useSetCurrentUser() {
	const queryClient = useQueryClient();
	return (user: CurrentUser) => queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user);
}
