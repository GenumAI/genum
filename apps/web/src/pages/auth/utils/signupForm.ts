import type { RegisterOptions } from "react-hook-form";
import { EMAIL_PATTERN } from "@/lib/email";

export type SignupFormData = {
	name: string;
	email: string;
	password: string;
	confirmPassword: string;
};

type SignupFormValidationRules = {
	[K in keyof SignupFormData]: RegisterOptions<SignupFormData, K>;
};

export const signupDefaultValues: SignupFormData = {
	name: "",
	email: "",
	password: "",
	confirmPassword: "",
};

export const signupFormValidationRules: SignupFormValidationRules = {
	name: {
		required: "Name is required",
		minLength: {
			value: 2,
			message: "Name must be at least 2 characters",
		},
	},
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
	confirmPassword: {
		required: "Please confirm your password",
	},
};

export const getSignupErrorMessage = (error: unknown) => {
	if (error instanceof Error && error.message) {
		return error.message;
	}

	return "Failed to create account. Please try again.";
};
