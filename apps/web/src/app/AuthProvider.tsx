import React, { ReactNode } from "react";
import { AppState, Auth0Provider } from "@auth0/auth0-react";
import { LocalAuthProvider } from "@/contexts/LocalAuthContext";
import { isLocalAuth } from "@/lib/auth";
import { runtimeConfig } from "@/lib/runtime-config";
import { useNavigate } from "react-router-dom";

interface AuthProviderProps {
	children: ReactNode;
}

/**
 * Conditional authentication provider that wraps either Auth0Provider (cloud)
 * or LocalAuthProvider (self-hosted) based on the VITE_AUTH_MODE environment variable
 *
 * Note: LocalAuthProvider is always included to support Login/Signup pages
 * that may be accessed regardless of auth mode
 */
export function AuthProvider({ children }: AuthProviderProps) {
	const navigate = useNavigate();

	if (isLocalAuth()) {
		return <LocalAuthProvider>{children}</LocalAuthProvider>;
	}

	const onRedirectCallback = (appState: AppState | undefined) => {
		navigate(appState?.returnTo || window.location.pathname, { replace: true });
	  };

	return (
		<LocalAuthProvider>
			<Auth0Provider
				domain={runtimeConfig.AUTH0_DOMAIN}
				clientId={runtimeConfig.AUTH0_CLIENT_ID}
				authorizationParams={{
					redirect_uri: window.location.origin,
					audience: runtimeConfig.AUTH0_AUDIENCE,
				}}
				onRedirectCallback={onRedirectCallback}
			>
				{children}
			</Auth0Provider>
		</LocalAuthProvider>
	);
}
