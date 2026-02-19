import type { RegisterOptions } from "react-hook-form";

export type SignupFormData = {
	name: string;
	email: string;
	password: string;
	confirmPassword: string;
};

type SignupFormValidationRules = {
	[K in keyof SignupFormData]: RegisterOptions<SignupFormData, K>;
};

const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

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
