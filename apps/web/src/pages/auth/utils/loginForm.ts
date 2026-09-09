import type { RegisterOptions } from "react-hook-form";
import { EMAIL_PATTERN } from "@/lib/email";

export type LoginFormData = {
	email: string;
	password: string;
};

type LoginFormValidationRules = {
	[K in keyof LoginFormData]: RegisterOptions<LoginFormData, K>;
};

export const loginDefaultValues: LoginFormData = {
	email: "",
	password: "",
};

export const loginFormValidationRules: LoginFormValidationRules = {
	email: {
		required: "Email is required",
		// The previous pattern here was ASCII-only and rejected every internationalized
		// address outright. EMAIL_PATTERN is the one core validates against, so what the
		// form accepts and what the API accepts cannot drift apart.
		pattern: {
			value: EMAIL_PATTERN,
			message: "Invalid email address",
		},
	},
	password: {
		required: "Password is required",
		minLength: {
			value: 6,
			message: "Password must be at least 6 characters",
		},
	},
};

export const getReturnTo = (searchParams: URLSearchParams) => searchParams.get("returnTo") || "/";

export const getLoginErrorMessage = (error: unknown) => {
	if (error instanceof Error && error.message) {
		return error.message;
	}

	return "Failed to log in. Please check your credentials.";
};
