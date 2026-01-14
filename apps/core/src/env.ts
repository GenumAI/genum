import { z } from "zod";

type RuntimeEnv = Record<string, string | undefined>;

const EnvSchema = z.object({
	// Instance
	NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
	CORE_PORT: z.coerce.number().int().positive(),
	INSTANCE_TYPE: z.enum(["local", "cloud"]).default("local"),
	// Database
	DATABASE_URL: z.url(),
	// ClickHouse
	CLICKHOUSE_URL: z.url(),
	CLICKHOUSE_DB: z.string(),
	CLICKHOUSE_USER: z.string(),
	CLICKHOUSE_PASSWORD: z.string().optional(),
	// Frontend
	FRONTEND_URL: z.url(),
	// AI Provider
	OPENAI_KEY: z.string().optional(),
	ANTHROPIC_KEY: z.string().optional(),
	GEMINI_KEY: z.string().optional(),
	// ------------------[CLOUD]------------------
	// Sentry
	RELEASE_VERSION: z.string().optional(),
	CORE_SENTRY_DSN: z.url().optional(),
	CORE_SENTRY_ENABLED: z.stringbool().optional().default(false),
	CORE_SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().optional().default(1.0),
	// Auth0
	AUTH0_DOMAIN: z.string().optional(),
	AUTH0_CLIENT_ID: z.string().optional(),
	AUTH0_AUDIENCE: z.string().optional(),
	AUTH0_USERID_CLAIM: z.string().optional(),
	AUTH0_ACTION_APIKEY: z.string().optional(),
	// Hooks
	WEBHOOK_USERNAME: z.string().optional().default(""),
	WEBHOOK_PASSWORD: z.string().optional().default(""),
	EMAIL_WEBHOOK_URL: z.url().optional().default(""),
	FEEDBACK_WEBHOOK_URL: z.url().optional().default(""),
	NEW_USER_WEBHOOK_URL: z.url().optional().default(""),
});

// delete empty env variables from runtime env
const removeEmptyEnvVariables = (runtimeEnv: RuntimeEnv): RuntimeEnv => {
	for (const [key, value] of Object.entries(runtimeEnv)) {
		if (value === "") {
			delete runtimeEnv[key];
		}
	}
	return runtimeEnv;
};

// Avoid parsing env variables in docker build
export const env: z.infer<typeof EnvSchema> =
	process.env.DOCKER_BUILD === "1"
		? // biome-ignore lint/suspicious/noExplicitAny: env is empty in docker build
			(process.env as any)
		: EnvSchema.parse(removeEmptyEnvVariables(process.env));
