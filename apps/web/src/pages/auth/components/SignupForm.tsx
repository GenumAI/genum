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
								<FormLabel className="text-foreground">Name</FormLabel>
								<FormControl>
									<Input
										type="text"
										placeholder="Your name"
										{...field}
										disabled={isLoading}
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
								<FormLabel className="text-foreground">Email</FormLabel>
								<FormControl>
									<Input
										type="email"
										placeholder="your.email@example.com"
										{...field}
										disabled={isLoading}
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
								<FormLabel className="text-foreground">Password</FormLabel>
								<FormControl>
									<Input
										type="password"
										placeholder="Enter your password"
										{...field}
										disabled={isLoading}
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
								<FormLabel className="text-foreground">Confirm Password</FormLabel>
								<FormControl>
									<Input
										type="password"
										placeholder="Confirm your password"
										{...field}
										disabled={isLoading}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<Button
						type="submit"
						className="min-h-[40px] w-full"
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
				<p className="text-sm text-muted-foreground">
					Already have an account?{" "}
					<button
						type="button"
						onClick={onLoginClick}
						className="font-medium text-brand hover:underline"
					>
						Log in
					</button>
				</p>
			</div>
		</>
	);
}
