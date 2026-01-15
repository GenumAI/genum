import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/useToast";
import { promptApi } from "@/api/prompt";

interface UseAIGenerationProps {
	mode: "schema" | "tool";
	promptId?: number | string;
	onReceived: (data: any) => void;
}

export const useAIGeneration = ({ mode, promptId, onReceived }: UseAIGenerationProps) => {
	const [input, setInput] = useState("");
	const [isOpen, setIsOpen] = useState(false);
	const { toast } = useToast();

	const isSchemaMode = mode === "schema";
	const label = isSchemaMode ? "schema" : "tool";

	const generationMutation = useMutation({
		mutationFn: async (data: { query: string; context?: any }) => {
			if (!promptId) throw new Error("Prompt ID is required");

			if (isSchemaMode) {
				return await promptApi.generateJsonSchema(promptId, {
					query: data.query,
					jsonSchema: data.context ? JSON.stringify(data.context) : undefined,
				});
			} else {
				return await promptApi.generateTool(promptId, {
					query: data.query,
					tool: data.context ? JSON.stringify(data.context) : undefined,
				});
			}
		},
	});

	const handleAction = async (existingData?: any) => {
		if (!input.trim() || !promptId) return;
		try {
			const response = await generationMutation.mutateAsync({
				query: input,
				context: existingData,
			});

			const receivedData = isSchemaMode
				? (response as { jsonSchema: any })?.jsonSchema
				: (response as { tool: any })?.tool;

			if (receivedData) {
				onReceived(receivedData);
				toast({
					title: `${isSchemaMode ? "Schema" : "Tool"} generated`,
					description: `${isSchemaMode ? "JSON schema" : "Tool"} was generated successfully`,
					variant: "default",
				});
				setIsOpen(false);
				setInput("");
			}
		} catch {
			toast({
				title: "Error",
				description: `Failed to generate ${label}`,
				variant: "destructive",
			});
		}
	};

	return {
		input,
		setInput,
		isOpen,
		setIsOpen,
		handleAction,
		isLoading: generationMutation.isPending,
		label,
	};
};
