import type React from "react";
import { BarChart2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AuditData } from "../utils/types";

interface AuditSectionProps {
	auditData: AuditData;
	onOpenDetails: () => void;
}

export const AuditSection: React.FC<AuditSectionProps> = ({ auditData, onOpenDetails }) => {
	return (
		<div>
			<h3 className="text-lg font-semibold text-foreground mb-3">Audit</h3>
			<Card className="border border-border shadow-sm rounded-md">
				<CardContent className="p-6 flex flex-row gap-8">
					<div className="flex flex-col items-start justify-between min-w-[237px]">
						<div className="flex flex-col items-start">
							<div className="flex items-center gap-1 text-brand">
								<BarChart2 className="w-4 h-4" />
								<span className="text-sm font-semibold">
									Score {auditData.rate}/100
								</span>
							</div>

							<div className="flex flex-row items-center gap-2 mt-2">
								<div className="h-2 min-w-[191px] w-full overflow-hidden rounded-full border border-border bg-surface-muted">
									<div
										className="h-full bg-gradient-to-r from-sky-500 to-green-500 transition-all duration-300"
										style={{ width: `${auditData.rate}%` }}
									/>
								</div>
								<span className="text-[10px] font-medium text-brand">
									{auditData.rate}%
								</span>
							</div>
						</div>
						<Button
							variant="outline"
							size="sm"
							onClick={onOpenDetails}
							className="text-[12px]"
						>
							Audit details
						</Button>
					</div>

					<div className="flex flex-col gap-2 rounded-md p-3 border border-border">
						<p className="text-sm text-foreground">{auditData.summary}</p>
					</div>
				</CardContent>
			</Card>
		</div>
	);
};
