import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart2 } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogFooter,
	DialogClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { usePlaygroundAudit, usePlaygroundActions } from "@/stores/playground.store";
import { helpersApi } from "@/api/helpers/helpers.api";
import { promptApi } from "@/api/prompt";
import { Separator } from "@/components/ui/separator";
import type { AuditRisk, AuditData } from "@/types/audit";

const getBadgeClass = (level: string): string => {
	switch (level.toLowerCase()) {
		case "high":
			return "bg-[#DC262629] hover:bg-[#DC262629] text-[#FF4545]";
		case "medium":
			return "bg-[#E1924826] hover:bg-[#E1924826] text-[#EC790E]";
		case "low":
			return "bg-[#2E9D2A14] hover:bg-[#2E9D2A14] text-[#2E9D2A]";
		default:
			return "bg-[#AAAAAA] text-[#18181B]";
	}
};

interface AuditResultsModalProps {
	promptId: string | number;
	promptValue: string;
	isDisabledFix?: boolean;
	existingAuditData?: AuditData | null;
	isOpen: boolean;
	onClose: () => void;
	onAuditComplete?: (auditData: AuditData) => void;
	setDiffModalInfo: React.Dispatch<
		React.SetStateAction<{
			prompt: string;
		} | null>
	>;
}

const AuditResultsModal = ({
	promptId,
	promptValue,
	isDisabledFix,
	existingAuditData,
	isOpen,
	onClose,
	onAuditComplete,
	setDiffModalInfo,
}: AuditResultsModalProps) => {
	const { currentAuditData: auditData, isAuditLoading: isStoreAuditLoading } =
		usePlaygroundAudit();
	const { setCurrentAuditData, setFlags } = usePlaygroundActions();

	const [isLocalAuditLoading, setIsLocalAuditLoading] = useState(false);
	const isAuditApiLoading = isLocalAuditLoading || isStoreAuditLoading;

	const [selectedRiskIndices, setAuditSelectedRiskIndices] = useState<number[]>([]);
	const [isFixing, setAuditIsFixing] = useState(false);

	const displayAuditData: AuditData | null = auditData || existingAuditData || null;
	const allRisks: AuditRisk[] = displayAuditData?.risks || [];
	const summary: string = displayAuditData?.summary || "No summary available.";
	const rate: number | undefined = displayAuditData?.rate;

	useEffect(() => {
		if (displayAuditData) {
			setAuditSelectedRiskIndices(allRisks.map((_: AuditRisk, index: number) => index));
		} else {
			setAuditSelectedRiskIndices([]);
		}
	}, [displayAuditData, allRisks.length]);

	const handleCloseModal = () => {
		setCurrentAuditData(null);
		onClose();
	};

	const handleRunAudit = async () => {
		setIsLocalAuditLoading(true);
		setFlags({ isAuditLoading: true });
		try {
			const data = await promptApi.auditPrompt(promptId);
			if (data?.audit) {
				setCurrentAuditData(data.audit);
				onAuditComplete?.(data.audit);
			}
		} catch (error) {
			console.error("Audit failed:", error);
		} finally {
			setIsLocalAuditLoading(false);
			setFlags({ isAuditLoading: false });
		}
	};

	useEffect(() => {
		if (auditData && onAuditComplete) {
			onAuditComplete(auditData);
		}
	}, [auditData, onAuditComplete]);

	const handleToggleRiskSelection = (index: number) => {
		setAuditSelectedRiskIndices(
			selectedRiskIndices.includes(index)
				? selectedRiskIndices.filter((i: number) => i !== index)
				: [...selectedRiskIndices, index],
		);
	};

	const generateContextFromRisks = (indicesToProcess: number[]): string => {
		return indicesToProcess
			.map((index: number) => allRisks[index].recommendation)
			.join("\\n\\n---\\n\\n");
	};

	const handleProceedToTune = async () => {
		if (selectedRiskIndices.length === 0) return;
		const context = generateContextFromRisks(selectedRiskIndices);
		setAuditIsFixing(true);

		try {
			const response = await helpersApi.promptTune({
				context,
				instruction: promptValue,
			});

			if (response && response.prompt) {
				setDiffModalInfo({
					prompt: response.prompt,
				});

				handleCloseModal();
			}
		} catch (error) {
			console.error("Error tuning prompt:", error);
		} finally {
			setAuditIsFixing(false);
		}
	};

	const renderFooter = () => {
		const buttons = [];

		if (!isDisabledFix) {
			buttons.push(
				<Button
					key="runAudit"
					variant="default"
					onClick={handleRunAudit}
					disabled={isAuditApiLoading}
					className="relative bg-[#437BEF]"
				>
					{isAuditApiLoading && (
						<span className="absolute inset-0 flex items-center justify-center">
							<svg
								className="animate-spin h-5 w-5 text-white dark:text-black"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
							>
								<circle
									className="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									strokeWidth="4"
								></circle>
								<path
									className="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
						</span>
					)}
					<span className={isAuditApiLoading ? "opacity-0" : ""}>Run Audit</span>
				</Button>,
			);

			if (displayAuditData && allRisks.length > 0) {
				buttons.push(
					<Button
						key="tuneSelectedConfirm"
						variant="default"
						onClick={handleProceedToTune}
						disabled={selectedRiskIndices.length === 0 || isFixing}
						className="relative"
					>
						{isFixing && (
							<span className="absolute inset-0 flex items-center justify-center">
								<svg
									className="animate-spin h-5 w-5 text-white dark:text-black"
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
								>
									<circle
										className="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										strokeWidth="4"
									></circle>
									<path
										className="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									></path>
								</svg>
							</span>
						)}
						<span className={isFixing ? "opacity-0" : ""}>Fix</span>
					</Button>,
				);
			}
		}

		return buttons;
	};

	if (isAuditApiLoading && !displayAuditData) {
		return (
			<Dialog open={isOpen} onOpenChange={onClose}>
				<DialogContent
					className={cn("max-w-[612px]", "max-h-[95vh]", "flex flex-col")}
					isDialogClose={false}
				>
					<div className="flex items-center justify-center py-8">
						<div className="flex items-center gap-3">
							<svg
								className="animate-spin h-6 w-6 text-[#437BEF]"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
							>
								<circle
									className="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									strokeWidth="4"
								></circle>
								<path
									className="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
							<span className="text-[14px] text-[#71717A] dark:text-[#A1A1AA]">
								Running audit...
							</span>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && handleCloseModal()}>
			<DialogContent
				className={cn("max-w-[612px]", "max-h-[95vh]", "flex flex-col", "gap-0")}
				isDialogClose={false}
			>
				<div className="flex items-start justify-between mb-3">
					<DialogTitle className="flex flex-col gap-0.5">
						<span className="leading-[28px]">Prompt Audit Results</span>
						{displayAuditData && (
							<span className="text-[12px] font-normal text-[#71717A] dark:text-[#A1A1AA]">
								Analysis completed • {allRisks.length} issues found
							</span>
						)}
					</DialogTitle>
					<DialogClose asChild>
						<Button
							variant="ghost"
							size="sm"
							className="absolute top-[18px] right-[18px]"
							onClick={handleCloseModal}
						>
							✕
						</Button>
					</DialogClose>
				</div>

				<div className="flex flex-col flex-grow overflow-y-auto minimal-scrollbar pr-1 -mr-1">
					{displayAuditData ? (
						<>
							<div className="flex justify-between items-center h-[28px] mb-2">
								<h5 className="text-[14px] font-semibold">Summary</h5>
								{typeof rate === "number" && (
									<h5 className="text-[14px] font-semibold text-[#437BEF] dark:text-[#739BEE] flex items-center gap-0.5">
										<BarChart2 className="h-4 w-4" />
										Score {rate}/100
									</h5>
								)}
							</div>
							<p className="mb-3 text-[12px] leading-[20px]">{summary}</p>

							<Separator className="my-1.5" />

							<div className="flex flex-col gap-0.5 my-3">
								<h5 className="text-[18px] font-semibold text-foreground">Risks</h5>
								<h6 className="text-[12px] text-muted-foreground">
									Confirm which risks to fix:
								</h6>
							</div>

							<div className="space-y-5">
								{allRisks.map((item: AuditRisk, index: number) => {
									const isSelected = selectedRiskIndices.includes(index);

									return (
										<Card
											key={item.type + index}
											className={`fix-mode-risk-item border-0 p-0 shadow-none dark:bg-[#313135]`}
										>
											<CardHeader className="p-0 pb-2">
												<div className="flex justify-between items-center h-7">
													<div className="flex items-center gap-2">
														{!isDisabledFix && (
															<Checkbox
																checked={isSelected}
																onCheckedChange={() =>
																	handleToggleRiskSelection(index)
																}
															/>
														)}
														<CardTitle className="text-base">
															{item.type
																.replace(/_/g, " ")
																.replace(/\b(\w)/g, (c: string) =>
																	c.toUpperCase(),
																)}
														</CardTitle>
														<Badge
															className={`${getBadgeClass(item.level)} rounded-full shadow-none`}
														>
															{item.level.charAt(0).toUpperCase() +
																item.level.slice(1).toLowerCase()}
														</Badge>
													</div>
												</div>
												<CardDescription className="text-[12px] text-[#71717A] dark:text-[#A1A1AA]">
													{item.comment}
												</CardDescription>
											</CardHeader>
											<CardContent className="border border-[#739BEE] rounded-[6px] p-3">
												<div className="text-[12px] text-[#437BEF] dark:text-[#739BEE]">
													{item.recommendation}
												</div>
											</CardContent>
										</Card>
									);
								})}
							</div>
						</>
					) : (
						<div className="flex items-center justify-center py-8">
							<div className="text-center">
								<h5 className="text-[14px] font-semibold mb-2">
									No audit data available
								</h5>
								<p className="text-[12px] text-[#71717A] dark:text-[#A1A1AA] mb-4">
									Run an audit to see the results
								</p>
							</div>
						</div>
					)}
				</div>

				<DialogFooter className="mt-3">{renderFooter()}</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export default AuditResultsModal;
