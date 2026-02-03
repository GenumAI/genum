import { Card, CardContent } from "@/components/ui/card";

import type { QuotaCardProps } from "../../utils/types";

function formatBalance(balance: number | null): string {
	if (balance === null) return "--";
	return `$${balance.toFixed(2)}`;
}

/**
 * Displays organization quota balance
 */
export function QuotaCard({ quota, isLoading }: QuotaCardProps) {
	return (
		<Card className="w-auto rounded-md shadow-[0px_1px_2px_0px_#0000000D] mx-6 mt-6 p-6">
			<CardContent className="p-0">
				<p className="text-[14px] leading-[20px] font-medium mb-2">Balance:</p>
				<p className="text-[24px] leading-[32px] font-bold">
					{isLoading ? "Loading..." : formatBalance(quota)}
				</p>
				<p className="text-[12px] leading-[16px] text-[#71717A]">
					While your organization has quota, it will be used for AI requests. Once the quota is
					exhausted, user-provided API keys will be used instead.
				</p>
			</CardContent>
		</Card>
	);
}
