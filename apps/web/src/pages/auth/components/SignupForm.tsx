import type { SubmitHandler, UseFormReturn } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { signupFormValidationRules, type SignupFormData } from "../utils/signupForm";

type SignupFormProps = {
	form: UseFormReturn<SignupFormData>;
	isLoading: boolean;
	onSubmit: SubmitHandler<SignupFormData>;
	onLoginClick: () => void;
};

export default function SignupForm({
	form,
	isLoading,
	onSubmit,
	onLoginClick,
}: SignupFormProps) {
	return (
		<>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					<FormField
						control={form.control}
						name="name"
						rules={signupFormValidationRules.name}
						render={({ field }) => (
							<FormItem>
								<FormLabel className="text-gray-900 dark:text-zinc-200">Name</FormLabel>
								<FormControl>
									<Input
										type="text"
										placeholder="Your name"
										{...field}
										disabled={isLoading}
										className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-500"
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="email"
						rules={signupFormValidationRules.email}
						render={({ field }) => (
							<FormItem>
								<FormLabel className="text-gray-900 dark:text-zinc-200">Email</FormLabel>
								<FormControl>
									<Input
										type="email"
										placeholder="your.email@example.com"
										{...field}
										disabled={isLoading}
										className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-500"
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="password"
						rules={signupFormValidationRules.password}
						render={({ field }) => (
							<FormItem>
								<FormLabel className="text-gray-900 dark:text-zinc-200">
									Password
								</FormLabel>
								<FormControl>
									<Input
										type="password"
										placeholder="Enter your password"
										{...field}
										disabled={isLoading}
										className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-500"
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="confirmPassword"
						rules={signupFormValidationRules.confirmPassword}
						render={({ field }) => (
							<FormItem>
								<FormLabel className="text-gray-900 dark:text-zinc-200">
									Confirm Password
								</FormLabel>
								<FormControl>
									<Input
										type="password"
										placeholder="Confirm your password"
										{...field}
										disabled={isLoading}
										className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-500"
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<Button
						type="submit"
						className="w-full min-h-[40px] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
						disabled={isLoading}
					>
						{isLoading ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Creating account...
							</>
						) : (
							"Sign Up"
						)}
					</Button>
				</form>
			</Form>

			<div className="text-center">
				<p className="text-sm text-gray-600 dark:text-zinc-400">
					Already have an account?{" "}
					<button
						type="button"
						onClick={onLoginClick}
						className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
					>
						Log in
					</button>
				</p>
			</div>
		</>
	);
}
