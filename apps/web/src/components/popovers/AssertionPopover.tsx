import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { promptApi } from "@/api/prompt";
import AIGenerateButton from "@/pages/prompt/playground-tabs/playground/components/settings-block/models-settings/components/ai-interface-editor/shared/code-editor/components/AIGenerateButton";

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

	const handleGenerate = () => {
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
							setInput("");
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
					setInput("");
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
	};

	return (
		<AIGenerateButton
			mode="prompt-generate"
			promptId={promptId}
			value={input}
			onChange={setInput}
			onAction={handleGenerate}
			isOpen={isOpen}
			setIsOpen={(open) => {
				setIsOpen(open);
				if (open) setInput("");
			}}
			isLoading={isLoading}
			placeholder="What rule do you want to create?"
			buttonText="Generate"
			tooltipText="Generate assertion rule"
			allowEmpty={true}
			textareaClassName="text-foreground text-[14px] font-normal leading-[20px]"
		/>
	);
}
