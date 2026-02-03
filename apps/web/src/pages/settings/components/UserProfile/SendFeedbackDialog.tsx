import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import type { SendFeedbackDialogProps } from "../../utils/types";

const FEEDBACK_TYPES = ["Question", "Report bug", "Feature request", "Other"];
const MAX_SUBJECT_LENGTH = 128;
const MAX_MESSAGE_LENGTH = 2500;


export function SendFeedbackDialog({
	open,
	onOpenChange,
	onSubmit,
	isSubmitting,
}: SendFeedbackDialogProps) {
	const [type, setType] = useState("Question");
	const [subject, setSubject] = useState("");
	const [message, setMessage] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!subject.trim() || !message.trim()) {
			return;
		}

		const success = await onSubmit(type, subject, message);
		if (success) {
			setType("Question");
			setSubject("");
			setMessage("");
			onOpenChange(false);
		}
	};

	const handleCancel = () => {
		onOpenChange(false);
	};

	useEffect(() => {
		if (!open) {
			setType("Question");
			setSubject("");
			setMessage("");
		}
	}, [open]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>
				<Button className="text-[14px] h-[36px] mt-0">Send Feedback</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Send Feedback</DialogTitle>
					<DialogDescription>
						Help us improve! Send your feedback, questions, or bug reports.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="feedback-type">Type</Label>
						<Select value={type} onValueChange={setType}>
							<SelectTrigger className="text-sm" id="feedback-type">
								<SelectValue placeholder="Select feedback type" />
							</SelectTrigger>
							<SelectContent>
								{FEEDBACK_TYPES.map((feedbackType) => (
									<SelectItem key={feedbackType} value={feedbackType}>
										{feedbackType}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<Label htmlFor="feedback-subject">Subject</Label>
							<span className="text-xs text-gray-500">
								{subject.length}/{MAX_SUBJECT_LENGTH}
							</span>
						</div>
						<Input
							id="feedback-subject"
							placeholder="Brief description of your feedback"
							value={subject}
							onChange={(e) => setSubject(e.target.value.slice(0, MAX_SUBJECT_LENGTH))}
							required
							maxLength={MAX_SUBJECT_LENGTH}
						/>
					</div>

					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<Label htmlFor="feedback-message">Message</Label>
							<span className="text-xs text-gray-500">
								{message.length}/{MAX_MESSAGE_LENGTH}
							</span>
						</div>
						<Textarea
							id="feedback-message"
							placeholder="Provide details about your feedback..."
							rows={5}
							value={message}
							onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
							required
							maxLength={MAX_MESSAGE_LENGTH}
						/>
					</div>

					<div className="flex justify-end gap-3 mt-6">
						<Button
							type="button"
							variant="outline"
							onClick={handleCancel}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={isSubmitting || !subject.trim() || !message.trim()}
						>
							{isSubmitting ? "Sending..." : "Send Feedback"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
