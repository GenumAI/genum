import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronUp } from "lucide-react";
import ModelsSettings from "./ModelsSettings";
import CanvasChat from "../canvas-chat/CanvasChat";
import { useSettingsBar } from "./hooks/useSettingsBar";
import { RunMetrics, ExecutionMetrics, CostBreakdownMetrics } from "./components/SettingsMetrics";
import { ModelsSettingsControlsSkeleton } from "../../../utils/playgroundSkeletons";
import type { SettingsBarProps } from "./utils/types";

export default function SettingsBar({
	prompt,
	models,
	tokens,
	cost,
	responseTime,
	updatePromptContent,
	isUpdatingPromptContent = false,
	onReadyStateChange,
}: SettingsBarProps) {
	const { promptId, isOpenModels, validModels, setIsModelValid, toggleModels } = useSettingsBar(
		prompt,
		models,
	);
	const [isToolsSectionVisible, setIsToolsSectionVisible] = useState(true);

	return (
		<div className="flex w-full flex-col gap-3">
			<div className="w-full rounded-2xl border border-[#83ABFF80] bg-card px-3 py-4 shadow-[0px_1px_2px_0px_#0000000F] shadow-[0px_1px_3px_0px_#0000001A]">
				<CanvasChat
					systemPrompt={prompt?.value ?? ""}
					updatePromptContent={updatePromptContent}
				/>
			</div>

			<div className="flex w-full flex-col gap-3 rounded-xl border bg-card px-3 py-4 shadow-[0px_1px_2px_0px_#0000000F] shadow-[0px_1px_3px_0px_#0000001A]">
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
					<div className={`h-full flex flex-col${isToolsSectionVisible ? " gap-3" : ""}`}>
						<ModelsSettings
							prompt={prompt}
							models={validModels}
							promptId={promptId}
							onValidationChange={setIsModelValid}
							isUpdatingPromptContent={isUpdatingPromptContent}
							onToolsSectionVisibilityChange={setIsToolsSectionVisible}
							loadingFallback={<ModelsSettingsControlsSkeleton />}
							onReadyStateChange={onReadyStateChange}
						/>

						<div className="flex flex-col gap-3">
							<Separator className="my-1" />
							<RunMetrics responseTime={responseTime} tokens={tokens} cost={cost} />
							<ExecutionMetrics
								responseTime={responseTime}
								totalTokens={tokens?.total}
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
