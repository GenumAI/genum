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
import { loginFormValidationRules, type LoginFormData } from "../utils/loginForm";

type LoginFormProps = {
	form: UseFormReturn<LoginFormData>;
	isLoading: boolean;
	onSubmit: SubmitHandler<LoginFormData>;
	onSignupClick: () => void;
};

export default function LoginForm({
	form,
	isLoading,
	onSubmit,
	onSignupClick,
}: LoginFormProps) {
	return (
		<>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					<FormField
						control={form.control}
						name="email"
						rules={loginFormValidationRules.email}
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
						rules={loginFormValidationRules.password}
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

					<Button
						type="submit"
						className="min-h-[40px] w-full"
						disabled={isLoading}
					>
						{isLoading ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Logging in...
							</>
						) : (
							"Log In"
						)}
					</Button>
				</form>
			</Form>

			<div className="text-center">
				<p className="text-sm text-muted-foreground">
					Don&apos;t have an account?{" "}
					<button
						type="button"
						onClick={onSignupClick}
						className="font-medium text-brand hover:underline"
					>
						Sign up
					</button>
				</p>
			</div>
		</>
	);
}
