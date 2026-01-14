import * as Sentry from "@sentry/react";
import { runtimeConfig } from "./runtime-config";

let isSentryInitialized = false;

export const initSentry = () => {
	// Prevent multiple initializations
	if (isSentryInitialized) {
		return;
	}

	// Only initialize if Sentry is enabled and DSN is provided
	if (!runtimeConfig.SENTRY_ENABLED || !runtimeConfig.SENTRY_DSN) {
		return;
	}

	try {
		Sentry.init({
			// Sentry config
			enabled: runtimeConfig.SENTRY_ENABLED, // enabled only in prod
			dsn: runtimeConfig.SENTRY_DSN,
			environment: runtimeConfig.SENTRY_ENVIRONMENT,
			release: runtimeConfig.RELEASE_VERSION || undefined,

			// Options
			sendDefaultPii: true,
			integrations: [
				Sentry.browserTracingIntegration(),
				Sentry.replayIntegration({
					maskAllText: false,
					maskAllInputs: false,
					blockAllMedia: false,
				}),
			],

			// Tracing
			tracesSampleRate: 1.0, //  Capture 100% of the transactions
			tracePropagationTargets: ["localhost", /^https:\/\/api\.genum\.ai\/api/],

			// Session Replay
			replaysSessionSampleRate: 1.0, //  Capture 100% of the sessions
			replaysOnErrorSampleRate: 1.0, //  Capture 100% of the errors
		});
		isSentryInitialized = true;
	} catch (error) {
		console.error("[Sentry] Failed to initialize Sentry:", error);
	}
};
