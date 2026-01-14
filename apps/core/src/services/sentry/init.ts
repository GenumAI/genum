import * as Sentry from "@sentry/node";
import { env } from "@/env";

/**
 * Initialize Sentry instrumentation for error tracking and logging.
 * Only initializes in production environment when SENTRY_DSN is provided.
 */
export function initializeSentry(): void {
	if (env.CORE_SENTRY_ENABLED && env.CORE_SENTRY_DSN) {
		Sentry.init({
			dsn: env.CORE_SENTRY_DSN,
			release: env.RELEASE_VERSION,
			environment: env.NODE_ENV,
			enableLogs: true,
			integrations: [
				Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
				Sentry.httpIntegration(),
			],
			tracesSampleRate: env.CORE_SENTRY_TRACES_SAMPLE_RATE,
		});
		console.log("Sentry initialized successfully");
	}
}

/**
 * Helper function to capture exceptions in Sentry.
 * Only sends to Sentry if Sentry is enabled and configured.
 *
 * @param error - The error to capture
 * @param tags - Optional tags to attach to the error
 */
export function captureSentryException(error: unknown, tags?: Record<string, string>): void {
	if (!env.CORE_SENTRY_ENABLED || !env.CORE_SENTRY_DSN) {
		return;
	}

	const sentryError = error instanceof Error ? error : new Error(String(error));

	Sentry.captureException(sentryError, {
		tags: tags || {},
	});
}
