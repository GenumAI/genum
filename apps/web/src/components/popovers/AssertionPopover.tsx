import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import PromptActionPopover from "@/components/popovers/PromptActionPopover";
import { useMutation } from "@tanstack/react-query";
import { promptApi } from "@/api/prompt";
import { TuneIcon } from "@/lib/icons/TuneIcon";

interface AssertionPopoverProps {
	promptId?: number | string;
	setAssertionValue: (val: string) => void;
	toast: (args: {
		title: string;
		description?: string;
		variant?: "default" | "destructive" | null;
	}) => void;
}

export default function AssertionPopover({
	promptId,
	setAssertionValue,
	toast,
}: AssertionPopoverProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [input, setInput] = useState("");

	const assertionMutation = useMutation({
		mutationFn: async (query: string) => {
			if (!promptId) throw new Error("Prompt ID is required");
			return await promptApi.generateAssertion(promptId, { query });
		},
	});

	const updatePromptMutation = useMutation({
		mutationFn: async (assertionValue: string) => {
			if (!promptId) throw new Error("Prompt ID is required");
			return await promptApi.updatePrompt(promptId, { assertionValue });
		},
	});

	const isLoading = assertionMutation.isPending || updatePromptMutation.isPending;

	return (
		<Popover
			open={isOpen}
			onOpenChange={(open) => {
				setIsOpen(open);
				if (open) setInput("");
			}}
		>
			<PopoverTrigger asChild>
				<Button variant="ghost" size="icon" className="h-6 w-6 [&_svg]:size-5 ml-2">
					<TuneIcon />
				</Button>
			</PopoverTrigger>
			<PromptActionPopover
				placeholder="What rule do you want to create?"
				value={input}
				onChange={setInput}
				onAction={() => {
					if (!promptId) return;

					assertionMutation.mutate(input, {
						onSuccess: (response) => {
							if (response?.assertion) {
								setAssertionValue(response.assertion);
								updatePromptMutation.mutate(response.assertion, {
									onSuccess: () => {
										toast({
											title: "Rule sent",
											description: "Your rule was sent successfully",
											variant: "default",
										});
										setIsOpen(false);
									},
									onError: () => {
										toast({
											title: "Error",
											description: "Failed to update prompt",
											variant: "destructive",
										});
									},
								});
							} else {
								toast({
									title: "Rule sent",
									description: "Your rule was sent successfully",
									variant: "default",
								});
								setIsOpen(false);
							}
						},
						onError: () => {
							toast({
								title: "Error",
								description: "Failed to send rule",
								variant: "destructive",
							});
						},
					});
				}}
				buttonText="Generate"
				buttonIcon={<TuneIcon stroke="currentColor" />}
				loading={isLoading}
				disabled={isLoading}
				textareaClassName="text-foreground text-[14px] font-normal leading-[20px]"
				allowEmpty={true}
			/>
		</Popover>
	);
}
