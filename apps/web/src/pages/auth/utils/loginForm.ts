import type { RegisterOptions } from "react-hook-form";

export type LoginFormData = {
	email: string;
	password: string;
};

type LoginFormValidationRules = {
	[K in keyof LoginFormData]: RegisterOptions<LoginFormData, K>;
};

const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export const loginDefaultValues: LoginFormData = {
	email: "",
	password: "",
};

export const loginFormValidationRules: LoginFormValidationRules = {
	email: {
		required: "Email is required",
		pattern: {
			value: emailRegex,
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
