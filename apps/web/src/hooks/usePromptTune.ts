import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { PromptTuneResponse } from "@/api/helpers";
import { helpersApi } from "@/api/helpers";
import { helperKeys } from "@/query-keys/helpers.keys";

export function usePromptTune({
	editorValue,
	testcaseInput,
	currentInputContent,
	expectedContent,
	setIsExpanded,
	toast,
	setIsOpenPromptDiff,
}: {
	editorValue: string;
	testcaseInput?: string;
	currentInputContent?: string;
	expectedContent?: any;
	onContentChange?: (
		value: string,
		options?: { isEmpty?: boolean; isWithoutUpdate?: boolean },
	) => void;
	setIsExpanded: (v: boolean) => void;
	toast: (args: any) => void;
	setIsOpenPromptDiff: (open: boolean) => void;
}) {
	const [promptText, setPromptText] = useState("");
	const [tuneText, setTuneText] = useState("");

	const promptTuneMutation = useMutation<
		PromptTuneResponse,
		unknown,
		{ context: string }
	>({
		mutationKey: helperKeys.promptTune(),
		mutationFn: async ({ context }) => {
			return await helpersApi.promptTune({
				instruction: editorValue,
				input: testcaseInput || "",
				output: currentInputContent || "",
				expectedOutput:
					typeof expectedContent === "object"
						? expectedContent?.answer || ""
						: expectedContent || "",
				context,
			});
		},
	});

	const runPromptTune = async (context: string, resetInput: () => void) => {
		try {
			await promptTuneMutation.mutateAsync({ context });
			setIsOpenPromptDiff(true);
			setIsExpanded(false);
			resetInput();
		} catch {
			toast({ title: "Something went wrong", variant: "destructive" });
		}
	};

	const handleGenerate = async () => {
		await runPromptTune(promptText.trim(), () => setPromptText(""));
	};

	const handleTune = async () => {
		await runPromptTune(tuneText.trim(), () => setTuneText(""));
	};

	return {
		promptText,
		setPromptText,
		tuneText,
		setTuneText,
		handleGenerate,
		handleTune,
		loading: promptTuneMutation.isPending,
		promptTuneMutation,
	};
}
