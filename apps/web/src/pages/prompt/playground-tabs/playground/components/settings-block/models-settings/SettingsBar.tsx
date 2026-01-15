import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronUp } from "lucide-react";
import ModelsSettings from "./ModelsSettings";
import CanvasChat from "../canvas-chat/CanvasChat";
import { useSettingsBar } from "./hooks/useSettingsBar";
import { RunMetrics, ExecutionMetrics, CostBreakdownMetrics } from "./components/SettingsMetrics";
import type { SettingsBarProps } from "./utils/types";

export default function SettingsBar({
	prompt,
	models,
	tokens,
	cost,
	responseTime,
	updatePromptContent,
	isUpdatingPromptContent = false,
}: SettingsBarProps) {
	const { promptId, isLoading, isOpenModels, validModels, setIsModelValid, toggleModels } =
		useSettingsBar(prompt, models);

	if (isLoading) {
		return (
			<div className="flex flex-col gap-3 mx-auto">
				<div className="rounded-xl border bg-white p-6 shadow-sm">
					<p className="text-[#71717A] text-center">Loading...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3 mx-auto">
			<div className="rounded-2xl border border-[#83ABFF80] py-4 px-3 shadow-[0px_1px_2px_0px_#0000000F] shadow-[0px_1px_3px_0px_#0000001A] w-full md:max-w-sm bg-card transition-all">
				<CanvasChat
					systemPrompt={prompt?.value ?? ""}
					updatePromptContent={updatePromptContent}
				/>
			</div>

			<div className="flex flex-col gap-3 rounded-xl border bg-card py-4 px-3 shadow-[0px_1px_2px_0px_#0000000F] shadow-[0px_1px_3px_0px_#0000001A]">
				<button
					type="button"
					onClick={toggleModels}
					className="flex w-full items-center justify-between cursor-pointer"
					aria-expanded={isOpenModels}
				>
					<div className="flex items-center gap-[6px]">
						<h2 className="text-foreground font-sans text-[14px] not-italic font-bold leading-[20px]">
							Model settings
						</h2>
					</div>

					<div className="flex items-center gap-3">
						<div className="text-[#18181B] dark:text-white">
							{isOpenModels ? (
								<ChevronUp className="w-4 h-4" />
							) : (
								<ChevronDown className="w-4 h-4" />
							)}
						</div>
					</div>
				</button>

				{isOpenModels && (
					<div className="h-full flex flex-col gap-3">
						<ModelsSettings
							prompt={prompt}
							models={validModels}
							promptId={promptId}
							onValidationChange={setIsModelValid}
							isUpdatingPromptContent={isUpdatingPromptContent}
						/>

						<div className="flex flex-col gap-3">
							<Separator className="my-1" />
							<RunMetrics responseTime={responseTime} tokens={tokens} cost={cost} />
							<ExecutionMetrics
								settings={prompt?.languageModel}
								responseTime={responseTime}
								promptTokens={tokens?.prompt}
								completionTokens={tokens?.completion}
							/>
							<CostBreakdownMetrics
								promptCost={cost?.prompt}
								completionCost={cost?.completion}
								totalCost={cost?.total}
							/>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
