import { memo } from "react";
import { Brain } from "lucide-react";
import type { Model } from "@/types/AIModel";
import { isReasoningModel, formatPrice } from "../utils/helpers";

interface ModelTooltipContentProps {
	model: Model;
}

export const ModelTooltipContent = memo(({ model }: ModelTooltipContentProps) => {
	const isReasoning = isReasoningModel(model.name);

	return (
		<div className="max-w-xs p-2">
			<div className="font-bold text-[14px] mb-1 text-background dark:text-white">
				{model.displayName || model.name}
			</div>

			{model.description && (
				<div className="text-[12px] text-background dark:text-white">
					{model.description}
				</div>
			)}

			<div className="text-[11px] flex flex-col gap-2.5">
				<div className="flex justify-between mt-4 items-center">
					<span className="text-background/70 dark:text-white/70">Vendor:</span>
					<span className="font-medium text-background dark:text-white">
						{model.vendor}
					</span>
				</div>

				<div className="flex justify-between gap-4 items-center">
					<span className="text-background/70 dark:text-white/70">Context:</span>
					<span className="text-background dark:text-white">
						{model.contextTokensMax?.toLocaleString()}
					</span>
				</div>

				<div className="flex justify-between gap-4 items-center">
					<span className="text-background/70 dark:text-white/70">Max tokens:</span>
					<span className="text-background dark:text-white">
						{model.completionTokensMax?.toLocaleString()}
					</span>
				</div>

				<div className="flex justify-between gap-4 items-center">
					<span className="text-background/70 dark:text-white/70">Prompt:</span>
					<span className="text-background dark:text-white">
						{formatPrice(model.promptPrice)} / 1M
					</span>
				</div>

				<div className="flex justify-between gap-4 items-center">
					<span className="text-background/70 dark:text-white/70">Completion:</span>
					<span className="text-background dark:text-white">
						{formatPrice(model.completionPrice)} / 1M
					</span>
				</div>

				{isReasoning && (
					<div className="flex flex-row items-center gap-2 text-[#6597FF] text-center mt-2">
						<Brain className="w-4" /> Reasoning Model
					</div>
				)}
			</div>
		</div>
	);
});

ModelTooltipContent.displayName = "ModelTooltipContent";
