import axios, {
	AxiosInstance,
	AxiosRequestConfig,
	AxiosResponse,
	InternalAxiosRequestConfig,
	AxiosError,
} from "axios";
import { isCloudAuth, getApiUrl } from "@/lib/auth";

/**
 * Custom error class for API errors with status code and response data
 */
export class ApiError extends Error {
	constructor(
		message: string,
		public status?: number,
		public data?: any,
		public originalError?: AxiosError,
	) {
		super(message);
		this.name = "ApiError";
		Object.setPrototypeOf(this, ApiError.prototype);
	}
}

/**
 * Configuration for API client context
 * Used to dynamically inject auth tokens and org/project IDs
 */
export interface ApiClientContext {
	getToken: () => Promise<string>;
	getOrgId: () => string | undefined;
	getProjectId: () => string | undefined;
}

/**
 * Extended request config with custom options
 */
export interface ExtendedAxiosRequestConfig extends AxiosRequestConfig {
	skipAuth?: boolean; // Skip adding auth headers
	skipOrgHeaders?: boolean; // Skip adding org/project headers
	withContentType?: boolean; // Whether to add Content-Type header (default: true for JSON, false for FormData)
}

// Global context storage
let apiContext: ApiClientContext | null = null;

/**
 * Set the API client context (called from hooks)
 */
export const setApiContext = (context: ApiClientContext) => {
	apiContext = context;
};

/**
 * Clear the API context
 */
export const clearApiContext = () => {
	apiContext = null;
};

/** Current orgId from API context (set in RedirectedToProjectRoute). Pass as argument to hooks. */
export const getOrgId = (): string | undefined => apiContext?.getOrgId();

/** Current projectId from API context. Pass as argument to hooks. */
export const getProjectId = (): string | undefined => apiContext?.getProjectId();

/**
 * Create axios instance with base configuration
 */
const createAxiosInstance = (): AxiosInstance => {
	const instance = axios.create({
		baseURL: getApiUrl(),
		timeout: 600000, // 10 min timeout
		withCredentials: true, // For cookie-based auth (self-hosted)
		headers: {
			"Content-Type": "application/json",
		},
	});

	// Request interceptor
	instance.interceptors.request.use(
		async (config: InternalAxiosRequestConfig) => {
			const isCloud = isCloudAuth();
			const extendedConfig = config as ExtendedAxiosRequestConfig;

			// Skip auth if explicitly requested
			if (!extendedConfig.skipAuth && apiContext) {
				try {
					const token = await apiContext.getToken();
					if (token && isCloud) {
						config.headers.Authorization = `Bearer ${token}`;
					}
				} catch (error) {
					console.warn("[API Client] Failed to get auth token:", error);
				}
			}

			// Add org/project headers if context is available
			if (!extendedConfig.skipOrgHeaders && apiContext) {
				const orgId = apiContext.getOrgId();
				const projectId = apiContext.getProjectId();

				if (orgId) {
					config.headers["lab-org-id"] = String(orgId);
				}
				if (projectId) {
					config.headers["lab-proj-id"] = String(projectId);
				}
			}

			// Handle credentials based on auth mode
			// Cloud auth (Auth0) doesn't need cookies, self-hosted does
			if (config.withCredentials === undefined) {
				config.withCredentials = !isCloud;
			}

			// Handle Content-Type header
			// If withContentType is explicitly false, don't set it
			// If data is FormData, axios will handle it automatically
			if (extendedConfig.withContentType === false) {
				delete config.headers["Content-Type"];
			} else if (
				!(config.data instanceof FormData) &&
				config.data !== undefined &&
				config.method !== "get" &&
				config.method !== "GET"
			) {
				// Only set Content-Type if not FormData and not GET request
				// Default behavior: add Content-Type for JSON requests
				config.headers["Content-Type"] = "application/json";
			}

			return config;
		},
		(error: AxiosError) => {
			return Promise.reject(error);
		},
	);

	// Response interceptor for error handling
	instance.interceptors.response.use(
		(response: AxiosResponse) => {
			return response;
		},
		async (error: AxiosError) => {
			// Handle network errors
			if (!error.response) {
				const networkError = new ApiError(
					error.message || "Network error occurred",
					undefined,
					undefined,
					error,
				);
				return Promise.reject(networkError);
			}

			// Handle HTTP errors
			const { status, data } = error.response;
			let errorMessage = "An error occurred";

			// Try to extract error message from response
			if (data) {
				if (typeof data === "string") {
					errorMessage = data;
				} else if (typeof data === "object") {
					errorMessage =
						(data as any).message ||
						(data as any).error ||
						(data as any).detail ||
						errorMessage;
				}
			}

			// Create structured error
			const apiError = new ApiError(errorMessage, status, data, error);

			// Log error for debugging (in production, you might want to send to error tracking)
			if (import.meta.env.DEV) {
				console.error("[API Client] Request failed:", {
					url: error.config?.url,
					method: error.config?.method,
					status,
					data,
				});
			}

			return Promise.reject(apiError);
		},
	);

	return instance;
};

// Export the configured axios instance
export const apiClient: AxiosInstance = createAxiosInstance();

/**
 * Helper function to create a request with custom context
 * Useful for one-off requests that don't use the global context
 */
export const createRequestWithContext = (context: ApiClientContext): AxiosInstance => {
	const instance = createAxiosInstance();

	// Override request interceptor to use provided context
	instance.interceptors.request.clear();
	instance.interceptors.request.use(
		async (config: InternalAxiosRequestConfig) => {
			const isCloud = isCloudAuth();
			const extendedConfig = config as ExtendedAxiosRequestConfig;

			if (!extendedConfig.skipAuth) {
				try {
					const token = await context.getToken();
					if (token && isCloud) {
						config.headers.Authorization = `Bearer ${token}`;
					}
				} catch (error) {
					console.warn("[API Client] Failed to get auth token:", error);
				}
			}

			if (!extendedConfig.skipOrgHeaders) {
				const orgId = context.getOrgId();
				const projectId = context.getProjectId();

				if (orgId) {
					config.headers["lab-org-id"] = String(orgId);
				}
				if (projectId) {
					config.headers["lab-proj-id"] = String(projectId);
				}
			}

			if (config.withCredentials === undefined) {
				config.withCredentials = !isCloud;
			}

			if (extendedConfig.withContentType === false) {
				delete config.headers["Content-Type"];
			} else if (
				!(config.data instanceof FormData) &&
				config.data !== undefined &&
				config.method !== "get" &&
				config.method !== "GET"
			) {
				config.headers["Content-Type"] = "application/json";
			}

			return config;
		},
		(error: AxiosError) => {
			return Promise.reject(error);
		},
	);

	return instance;
};

/**
 * Type helper for API response data
 */
export type ApiResponse<T = any> = AxiosResponse<T>;

/**
 * Type helper for API request config
 */
export type ApiRequestConfig = ExtendedAxiosRequestConfig;
