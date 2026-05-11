import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart2 } from "lucide-react";
import { CircleNotch } from "phosphor-react";
import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogFooter,
	DialogClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import type { AuditRisk, AuditData } from "@/types/audit";

const RISK_BADGE_STYLES = {
	high: "bg-destructive/15 hover:bg-destructive/15 text-destructive",
	medium: "bg-warning/20 hover:bg-warning/20 text-warning",
	low: "bg-success/15 hover:bg-success/15 text-success",
} as const;

const DEFAULT_BADGE_STYLE = "bg-muted text-foreground";

const getBadgeClass = (level: string): string => {
	const normalizedLevel = level.toLowerCase() as keyof typeof RISK_BADGE_STYLES;
	return RISK_BADGE_STYLES[normalizedLevel] || DEFAULT_BADGE_STYLE;
};

interface AuditResultsModalProps {
	auditData: AuditData | null;
	isLoading: boolean;
	isFixing: boolean;
	isDisabledFix?: boolean;
	isOpen: boolean;
	onClose: () => void;
	onRunAudit: () => void;
	onFixRisks: (recommendations: string[]) => void;
}

const AuditResultsModal = ({
	auditData,
	isLoading,
	isFixing,
	isDisabledFix,
	isOpen,
	onClose,
	onRunAudit,
	onFixRisks,
}: AuditResultsModalProps) => {
	const [selectedRiskIndices, setAuditSelectedRiskIndices] = useState<number[]>([]);

	const allRisks: AuditRisk[] = auditData?.risks || [];
	const summary: string = auditData?.summary || "No summary available.";
	const rate: number | undefined = auditData?.rate;

	useEffect(() => {
		if (auditData?.risks) {
			setAuditSelectedRiskIndices(
				auditData.risks.map((_: AuditRisk, index: number) => index),
			);
		} else {
			setAuditSelectedRiskIndices([]);
		}
	}, [auditData]);

	const handleToggleRiskSelection = (index: number) => {
		setAuditSelectedRiskIndices(
			selectedRiskIndices.includes(index)
				? selectedRiskIndices.filter((i: number) => i !== index)
				: [...selectedRiskIndices, index],
		);
	};

	const handleProceedToTune = () => {
		if (selectedRiskIndices.length === 0) return;

		const recommendations = selectedRiskIndices.map(
			(index: number) => allRisks[index].recommendation,
		);

		onFixRisks(recommendations);
	};

	const renderFooter = () => {
		const buttons = [];

		if (!isDisabledFix) {
			buttons.push(
				<Button
					key="runAudit"
					variant="default"
					onClick={onRunAudit}
					disabled={isLoading}
					className="relative bg-brand text-brand-foreground"
				>
					{isLoading && (
						<span className="absolute inset-0 flex items-center justify-center">
							<CircleNotch size={20} className="animate-spin text-brand-foreground" />
						</span>
					)}
					<span className={isLoading ? "opacity-0" : ""}>Run Audit</span>
				</Button>,
			);

			if (auditData && allRisks.length > 0) {
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
								<CircleNotch
									size={20}
									className="animate-spin text-primary-foreground"
								/>
							</span>
						)}
						<span className={isFixing ? "opacity-0" : ""}>Fix</span>
					</Button>,
				);
			}
		}

		return buttons;
	};

	if (isLoading && !auditData) {
		return (
			<Dialog open={isOpen} onOpenChange={onClose}>
				<DialogContent
					className={cn("max-w-[612px]", "max-h-[95vh]", "flex flex-col")}
					isDialogClose={false}
				>
					<div className="flex items-center justify-center py-8">
						<div className="flex items-center gap-3">
							<CircleNotch size={24} className="animate-spin text-brand" />
							<span className="text-[14px] text-muted-foreground">
								Running audit...
							</span>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				className={cn("max-w-[612px]", "max-h-[95vh]", "flex flex-col", "gap-0")}
				isDialogClose={false}
			>
				<div className="flex items-start justify-between mb-3">
					<DialogTitle className="flex flex-col gap-0.5">
						<span className="leading-[28px]">Prompt Audit Results</span>
						{auditData && (
							<span className="text-[12px] font-normal text-muted-foreground">
								Analysis completed • {allRisks.length} issues found
							</span>
						)}
					</DialogTitle>
					<DialogClose asChild>
						<Button
							variant="ghost"
							size="sm"
							className="absolute top-[18px] right-[18px]"
							onClick={onClose}
						>
							✕
						</Button>
					</DialogClose>
				</div>

				<div className="flex flex-col flex-grow overflow-y-auto minimal-scrollbar pr-1 -mr-1">
					{auditData ? (
						<>
							<div className="flex justify-between items-center h-[28px] mb-2">
								<h5 className="text-[14px] font-semibold">Summary</h5>
								{typeof rate === "number" && (
									<h5 className="flex items-center gap-0.5 text-[14px] font-semibold text-brand">
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
											key={`${item.type}-${item.level}-${index}`}
											className="fix-mode-risk-item border-0 p-0 shadow-none"
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
												<CardDescription className="text-[12px] text-muted-foreground">
													{item.comment}
												</CardDescription>
											</CardHeader>
											<CardContent className="rounded-[6px] border border-brand/50 p-3">
												<div className="text-[12px] text-brand">
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
								<p className="mb-4 text-[12px] text-muted-foreground">
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
