import { Separator } from "@/components/ui/separator";
import { Clock, Ticket, Coins, ChevronDown, ChevronUp } from "lucide-react";
import ModelsSettings from "@/pages/prompt/playground-tabs/playground/settings-block/models-settings/ModelsSettings";
import { useMemo, useState, useEffect, ReactElement } from "react";
import CanvasChat from "./canvas-chat/CanvasChat";
import { PromptSettings, TLanguageModel } from "@/types/Prompt";
import { usePlaygroundActions, usePlaygroundTestcase } from "@/stores/playground.store";

type TimeParam = {
	prompt: number;
	completion: number;
	total: number;
};

interface SettingsBarProps {
	prompt?: PromptSettings;
	models: any;
	tokens?: TimeParam | null;
	cost?: TimeParam | null;
	responseTime?: number | null;
	updatePromptContent: (value: string) => void;
	isUpdatingPromptContent?: boolean;
}

export default function SettingsBar({
	prompt,
	models,
	tokens,
	cost,
	responseTime,
	updatePromptContent,
	isUpdatingPromptContent = false,
}: SettingsBarProps) {
	const promptId = prompt?.id;
	const isLoading = !prompt || !promptId;

	const { currentAssertionType } = usePlaygroundTestcase();

	const { setAssertionValue, setCurrentAssertionType } = usePlaygroundActions();

	const [setIsModelValid] = useState<() => void>(() => {});
	const [isOpenModels, setIsOpenModels] = useState(true);

	useEffect(() => {
		if (prompt) {
			setCurrentAssertionType(prompt.assertionType || "AI");
			setAssertionValue(prompt.assertionValue || "");
		}
	}, [prompt, setCurrentAssertionType, setAssertionValue]);

	const validModels = useMemo(() => {
		if (!models || !Array.isArray(models)) {
			return [];
		}
		return models.filter(
			(model) =>
				model &&
				typeof model === "object" &&
				model.id &&
				model.name &&
				typeof model.name === "string",
		);
	}, [models]);

	useEffect(() => {
		const handleAssertionTypeChange = (event: CustomEvent) => {
			const { assertionType: newAssertionType } = event.detail;
			if (newAssertionType && newAssertionType !== currentAssertionType) {
				setCurrentAssertionType(newAssertionType);
			}
		};

		window.addEventListener("assertionTypeChanged", handleAssertionTypeChange as EventListener);

		return () => {
			window.removeEventListener(
				"assertionTypeChanged",
				handleAssertionTypeChange as EventListener,
			);
		};
	}, [currentAssertionType, setCurrentAssertionType]);

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
				<div
					onClick={() => setIsOpenModels(!isOpenModels)}
					className="cursor-pointer flex items-center justify-between"
				>
					<div className="flex items-center gap-[6px]">
						<h2 className="text-foreground font-sans text-[14px] not-italic font-bold leading-[20px]">
							Model settings
						</h2>
					</div>

					<div className="flex items-center gap-3">
						<button
							className="text-[#18181B] dark:text-white"
							onClick={(e) => {
								e.stopPropagation();
								setIsOpenModels(!isOpenModels);
							}}
						>
							{isOpenModels ? (
								<ChevronUp className="w-4 h-4" />
							) : (
								<ChevronDown className="w-4 h-4" />
							)}
						</button>
					</div>
				</div>

				{isOpenModels && (
					<div className="h-full flex flex-col gap-3">
						<ModelsSettings
							prompt={prompt}
							models={validModels}
							promptId={promptId}
							onValidationChange={setIsModelValid}
							isUpdatingPromptContent={isUpdatingPromptContent}
						/>

						<>
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
						</>
					</div>
				)}
			</div>
		</div>
	);
}

const MetricsRow = ({
	icon,
	title,
	value,
}: {
	icon: ReactElement;
	title: string;
	value: number | string;
}) => {
	return (
		<li className="flex justify-between items-center text-[#18181B] dark:text-white font-sans text-[10px] not-italic font-normal leading-[16px]">
			<div className="flex items-center gap-2">
				{icon} {title}
			</div>
			<span>{value}</span>
		</li>
	);
};

const RunMetrics = ({
	responseTime,
	tokens,
	cost,
}: {
	responseTime?: number | null;
	tokens?: TimeParam | null;
	cost?: TimeParam | null;
}) => {
	return (
		<div className="flex flex-col gap-2">
			<span className="text-[#18181B] dark:text-white font-sans text-[14px] not-italic font-bold leading-[14px]">
				Run Metrics
			</span>
			<ul className="flex flex-col gap-1.5">
				{tokens && (
					<MetricsRow
						icon={<Ticket size={16} />}
						title={"Token Usage"}
						value={tokens.total}
					/>
				)}
				{cost && (
					<MetricsRow
						icon={<Coins size={16} />}
						title={"Cost"}
						value={`$${cost.total.toFixed(6)}`}
					/>
				)}
			</ul>
		</div>
	);
};

const ExecutionMetrics = ({
	settings,
	responseTime,
	promptTokens,
	completionTokens,
}: {
	settings: TLanguageModel;
	responseTime?: number | null;
	promptTokens?: number;
	completionTokens?: number;
}) => {
	if (!responseTime && !settings?.completionTokensMax && !promptTokens && !completionTokens) {
		return null;
	}
	return (
		<div className="flex flex-col gap-2">
			<span className="text-[#18181B] dark:text-white font-sans text-[14px] not-italic font-bold leading-[14px]">
				Execution Metrics
			</span>
			<ul className="flex flex-col gap-1.5">
				{!!responseTime && (
					<MetricsRow
						icon={<Clock size={16} />}
						title={"Response time"}
						value={`${responseTime} ms`}
					/>
				)}
				{!!settings?.completionTokensMax && (
					<MetricsRow
						icon={<Ticket size={16} />}
						title={"Total tokens"}
						value={settings?.completionTokensMax}
					/>
				)}
				{!!promptTokens && (
					<MetricsRow
						icon={<Ticket size={16} />}
						title={"Prompt tokens"}
						value={promptTokens}
					/>
				)}
				{!!completionTokens && (
					<MetricsRow
						icon={<Ticket size={16} />}
						title={"Completion tokens"}
						value={completionTokens}
					/>
				)}
			</ul>
		</div>
	);
};

const CostBreakdownMetrics = ({
	promptCost,
	completionCost,
	totalCost,
}: {
	promptCost?: number;
	completionCost?: number;
	totalCost?: number;
}) => {
	if (!totalCost && !completionCost && !totalCost) {
		return null;
	}
	return (
		<div className="flex flex-col gap-2">
			<span className="text-[#18181B] dark:text-white font-sans text-[14px] not-italic font-bold leading-[14px]">
				Cost Breakdown
			</span>
			<ul className="flex flex-col gap-1.5">
				{!!promptCost && (
					<MetricsRow
						icon={<Coins size={16} />}
						title={"Prompt cost"}
						value={promptCost?.toFixed(6)}
					/>
				)}
				{!!completionCost && (
					<MetricsRow
						icon={<Coins size={16} />}
						title={"Completion cost"}
						value={completionCost?.toFixed(6)}
					/>
				)}
				{!!totalCost && (
					<MetricsRow
						icon={<Coins size={16} />}
						title={"Total cost"}
						value={totalCost?.toFixed(6)}
					/>
				)}
			</ul>
		</div>
	);
};
