import { Card, CardContent } from "@/components/ui/card";
import { isLocalAuth } from "@/lib/auth";

import type { QuotaCardProps } from "../../utils/types";

function formatBalance(balance: number | null): string {
	if (balance === null) return "--";
	return `$${balance.toFixed(2)}`;
}

/**
 * Displays organization quota balance
 */
export function QuotaCard({ quota, isLoading }: QuotaCardProps) {
	if (isLocalAuth()) return null;

	return (
		<Card className="mx-6 mt-6 w-auto rounded-md p-6 shadow-sm">
			<CardContent className="p-0">
				<p className="text-[14px] leading-[20px] font-medium mb-2">Balance:</p>
				<p className="text-[24px] leading-[32px] font-bold">
					{isLoading ? "Loading..." : formatBalance(quota)}
				</p>
				<p className="text-[12px] leading-[16px] text-muted-foreground">
					While your organization has quota, it will be used for AI requests. Once the quota is
					exhausted, user-provided API keys will be used instead.
				</p>
			</CardContent>
		</Card>
	);
}
