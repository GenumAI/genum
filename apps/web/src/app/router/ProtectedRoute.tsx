import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isCloudAuth } from "@/lib/auth";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
	const { isAuthenticated, isLoading, loginWithRedirect } = useAuth();
	const navigate = useNavigate();
	const isCloud = isCloudAuth();

	useEffect(() => {
		if (!isLoading && !isAuthenticated) {
			const currentPath = window.location.pathname + window.location.search;
			if (isCloud) {
				// Cloud mode: Auth0 always comes back to the origin, so the deep link travels in
				// appState and AuthProvider's onRedirectCallback navigates to it.
				loginWithRedirect({ appState: { returnTo: currentPath } });
			} else {
				// Self-hosted mode: redirect to login page
				navigate(`/login?returnTo=${encodeURIComponent(currentPath)}`);
			}
		}
	}, [isAuthenticated, isLoading, loginWithRedirect, navigate, isCloud]);

	if (isLoading) return null;

	if (!isAuthenticated) {
		return null;
	}

	return <>{children}</>;
}
