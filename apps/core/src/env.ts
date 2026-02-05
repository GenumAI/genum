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
	CORE_SENTRY_DSN: z.url().optional(),
	CORE_SENTRY_ENABLED: z.stringbool().optional().default(false),
	CORE_SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().optional().default(1.0),
	SENTRY_ENVIRONMENT: z.string().optional(),
	// Auth0
	AUTH0_DOMAIN: z.string().optional(),
	AUTH0_CLIENT_ID: z.string().optional(),
	AUTH0_AUDIENCE: z.string().optional(),
	AUTH0_USERID_CLAIM: z.string().optional(),
	AUTH0_ACTION_APIKEY: z.string().optional(),
	// Hooks
	WEBHOOK_USERNAME: z.string().optional().default(""),
	WEBHOOK_PASSWORD: z.string().optional().default(""),
	WEBHOOK_EMAIL_URL: z.url().optional().default(""),
	WEBHOOK_FEEDBACK_URL: z.url().optional().default(""),
	WEBHOOK_NEW_USER_URL: z.url().optional().default(""),
	// S3 Storage
	S3_BUCKET: z.string().optional().default("genum"),
	S3_REGION: z.string().optional().default("us-east-1"), // default region for local MinIO
	S3_ACCESS_KEY_ID: z.string().optional().default("minio"),
	S3_SECRET_ACCESS_KEY: z.string().optional().default("miniosecret"),
	// S3_ENDPOINT: defaults to localhost:9090 for local dev
	// To use AWS S3 in production, set S3_ENDPOINT=undefined in your .env to override
	S3_ENDPOINT: z.preprocess((val) => {
		// Not set = use default for local dev
		if (val === undefined) return "http://localhost:9090";
		// Explicitly set to 'undefined' = default for AWS SDK
		if (val === "undefined") return undefined;
		// Custom value = use as-is
		return val;
	}, z.url().optional()),
	S3_FORCE_PATH_STYLE: z.coerce.boolean().optional().default(true),
	S3_PUBLIC_ENDPOINT: z.url().optional(),
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
