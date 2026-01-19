/**
 * Runtime Configuration System
 *
 * This module provides a way to configure the application at runtime instead of build-time.
 * This is essential for Docker images that need to be reusable across different environments.
 *
 * Priority order:
 * 1. window.__ENV__ (runtime injection via env.js file)
 * 2. import.meta.env.VITE_* (build-time fallback for development)
 *
 * This allows:
 * - Publishing images to Docker Hub without hardcoded values
 * - Users to configure via environment variables at container startup
 * - Backward compatibility with build-time configuration
 */

/**
 * Runtime environment configuration injected by env.js file
 * This is loaded from /env.js before the app script loads
 */
declare global {
	interface Window {
		__ENV__?: {
			API_URL?: string;
			AUTH_MODE?: string;
			AUTH0_DOMAIN?: string;
			AUTH0_CLIENT_ID?: string;
			AUTH0_AUDIENCE?: string;
			SENTRY_ENABLED?: string;
			SENTRY_DSN?: string;
			SENTRY_ENVIRONMENT?: string;
			GA_TRACKING_ID?: string;
		};
	}
}

/**
 * Get a configuration value with fallback chain:
 * 1. window.__ENV__ (runtime)
 * 2. import.meta.env.VITE_* (build-time)
 * 3. defaultValue (optional)
 */
function getConfig(key: string, defaultValue?: string): string {
	// Try runtime config first (from window.__ENV__)
	if (typeof window !== "undefined" && window.__ENV__) {
		const runtimeValue = window.__ENV__[key as keyof typeof window.__ENV__];
		if (runtimeValue !== undefined && runtimeValue !== "") {
			return runtimeValue;
		}
	}

	// Fallback to build-time config (Vite)
	// Automatically generate VITE_ prefixed key
	const viteKey = `VITE_${key}`;
	const viteValue = (import.meta.env as Record<string, any>)[viteKey];
	if (viteValue && typeof viteValue === "string") {
		return viteValue;
	}

	// Return default if provided
	return defaultValue || "";
}

/**
 * Get boolean configuration value
 */
function getBooleanConfig(key: string, defaultValue = false): boolean {
	const value = getConfig(key);
	if (!value) return defaultValue;
	return value.toLowerCase() === "true" || value === "1";
}

/**
 * Public API for runtime configuration
 */
export const runtimeConfig = {
	/**
	 * API base URL
	 */
	get API_URL(): string {
		return getConfig("API_URL", "");
	},

	/**
	 * Authentication mode: 'cloud' or 'local'
	 */
	get AUTH_MODE(): string {
		return getConfig("AUTH_MODE", "local");
	},

	/**
	 * Auth0 domain (for cloud auth)
	 */
	get AUTH0_DOMAIN(): string {
		return getConfig("AUTH0_DOMAIN", "");
	},

	/**
	 * Auth0 client ID (for cloud auth)
	 */
	get AUTH0_CLIENT_ID(): string {
		return getConfig("AUTH0_CLIENT_ID", "");
	},

	/**
	 * Auth0 audience (for cloud auth)
	 */
	get AUTH0_AUDIENCE(): string {
		return getConfig("AUTH0_AUDIENCE", "");
	},

	/**
	 * Sentry enabled flag
	 */
	get SENTRY_ENABLED(): boolean {
		return getBooleanConfig("SENTRY_ENABLED", false);
	},

	/**
	 * Sentry DSN
	 */
	get SENTRY_DSN(): string {
		return getConfig("SENTRY_DSN", "");
	},

	/**
	 * Sentry environment
	 */
	get SENTRY_ENVIRONMENT(): string {
		return getConfig("SENTRY_ENVIRONMENT", "");
	},

	/**
	 * Google Analytics tracking ID
	 */
	get GA_TRACKING_ID(): string {
		return getConfig("GA_TRACKING_ID", "");
	},
};

/**
 * Debug helper: log current configuration source
 * Useful for troubleshooting configuration issues
 */
export function debugConfig(): void {
	if (import.meta.env.DEV) {
		console.log("[Runtime Config] Current configuration:", {
			source: typeof window !== "undefined" && window.__ENV__ ? "runtime" : "build-time",
			config: {
				API_URL: runtimeConfig.API_URL,
				AUTH_MODE: runtimeConfig.AUTH_MODE,
				AUTH0_DOMAIN: runtimeConfig.AUTH0_DOMAIN,
				AUTH0_CLIENT_ID: runtimeConfig.AUTH0_CLIENT_ID,
				AUTH0_AUDIENCE: runtimeConfig.AUTH0_AUDIENCE,
				SENTRY_ENABLED: runtimeConfig.SENTRY_ENABLED,
				SENTRY_DSN: runtimeConfig.SENTRY_DSN ? "***" : "",
				SENTRY_ENVIRONMENT: runtimeConfig.SENTRY_ENVIRONMENT,
				GA_TRACKING_ID: runtimeConfig.GA_TRACKING_ID ? "***" : "",
			},
		});
	}
}
