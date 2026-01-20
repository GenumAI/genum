import type React from "react";
import { cn } from "@/lib/utils";

interface DiffStatBadgeProps {
	added: number;
	removed: number;
	className?: string;
}

export const DiffStatBadge: React.FC<DiffStatBadgeProps> = ({ added, removed, className }) => {
	if (added === 0 && removed === 0) return null;

	return (
		<span className={cn("ml-2 flex items-center gap-3 text-xs", className)}>
			<span className="text-green-600">+{added}</span>
			<span className="text-red-500">-{removed}</span>
			<span className="text-muted-foreground">lines changed</span>
		</span>
	);
};
