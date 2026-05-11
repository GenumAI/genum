import React, { useState, useRef } from "react";
import { useToast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { userApi } from "@/api/user";

interface FeedbackButtonProps {
	className?: string;
	buttonText?: string;
}

export function FeedbackButton({
	className = "",
	buttonText = "Send Feedback",
}: FeedbackButtonProps) {
	const { toast } = useToast();

	const [open, setOpen] = useState(false);
	const [type, setType] = useState("Question");
	const [subject, setSubject] = useState("");
	const [message, setMessage] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const messageInputRef = useRef<HTMLTextAreaElement>(null);

	const feedbackTypes = ["Question", "Report bug", "Feature request", "Other"];

	const handleFeedbackSubmit = async () => {
		if (!subject.trim() || !message.trim()) {
			return;
		}

		const apiType = type.toLowerCase().replace(/ /g, "_");

		setIsSubmitting(true);
		try {
			await userApi.sendFeedback({
				type: apiType,
				subject: subject.trim(),
				message: message.trim(),
			});

			toast({
				title: "Feedback sent",
				description: "Thank you for your feedback!",
				duration: 3000,
			});

			setOpen(false);
			setType("Question");
			setSubject("");
			setMessage("");
		} catch (error) {
			console.error("Error sending feedback:", error);
			toast({
				title: "Error",
				description: "Failed to send feedback. Please try again.",
				variant: "destructive",
				duration: 3000,
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		void handleFeedbackSubmit();
	};

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			void handleFeedbackSubmit();
		}
	};

	return (
		<div className="flex flex-1 items-end overflow-hidden">
			<div
				className={`flex w-full flex-col items-center justify-center rounded-2xl border border-border bg-card px-4 py-3 ${className}`}
			>
				<p className="mb-2 text-center text-[12px] font-medium text-muted-foreground">
					Got something on your mind?
					<br />
					Let us know.
				</p>

				<Dialog open={open} onOpenChange={setOpen}>
					<DialogTrigger asChild>
						<Button size="lg" className="text-[12px] py-1 h-[28px] max-w-[148px]">
							{buttonText}{" "}
						</Button>
					</DialogTrigger>
					<DialogContent
						className="sm:max-w-[500px]"
						onOpenAutoFocus={(e) => {
							e.preventDefault();
							messageInputRef.current?.focus();
						}}
						onKeyDown={handleKeyDown}
					>
						<DialogHeader>
							<DialogTitle>Send Feedback</DialogTitle>
							<DialogDescription>
								Help us improve! Send your feedback, questions, or bug reports.
							</DialogDescription>
						</DialogHeader>
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="type">Type</Label>
								<Select value={type} onValueChange={setType}>
									<SelectTrigger className="text-sm" id="type">
										<SelectValue placeholder="Select feedback type" />
									</SelectTrigger>
									<SelectContent>
										{" "}
										{feedbackTypes.map((feedbackType) => (
											<SelectItem key={feedbackType} value={feedbackType}>
												{feedbackType}{" "}
											</SelectItem>
										))}{" "}
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<Label htmlFor="subject">Subject</Label>
									<span className="text-xs text-muted-foreground">
										{subject.length}/128
									</span>
								</div>
								<Input
									id="subject"
									placeholder="Brief description of your feedback"
									value={subject}
									onChange={(e) => setSubject(e.target.value.slice(0, 128))}
									required
									maxLength={128}
								/>
							</div>

							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<Label htmlFor="message">Message</Label>
									<span className="text-xs text-muted-foreground">
										{message.length}/2500
									</span>
								</div>
								<Textarea
									ref={messageInputRef}
									id="message"
									placeholder="Provide details about your feedback..."
									rows={5}
									value={message}
									onChange={(e) => setMessage(e.target.value.slice(0, 2500))}
									required
									maxLength={2500}
								/>
								<p className="pt-1 pb-6 text-xs text-muted-foreground text-right">
									<kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
										Ctrl
									</kbd>{" "}
									+{" "}
									<kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
										Enter
									</kbd>{" "}
									to send feedback
								</p>
							</div>

							<div className="flex justify-end gap-3 mt-0">
								<Button
									type="button"
									variant="outline"
									onClick={() => setOpen(false)}
									disabled={isSubmitting}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									disabled={isSubmitting || !subject.trim() || !message.trim()}
								>
									{isSubmitting ? "Sending..." : "Send Feedback"}{" "}
								</Button>
							</div>
						</form>
					</DialogContent>
				</Dialog>
			</div>
		</div>
	);
}
