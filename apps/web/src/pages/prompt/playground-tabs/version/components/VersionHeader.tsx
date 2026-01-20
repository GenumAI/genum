import type React from "react";
import { formatUserLocalDateTime } from "@/lib/formatUserLocalDateTime";

interface VersionHeaderProps {
	commitMsg: string;
	commitHash: string;
	createdAt: string;
	authorName: string;
}

export const VersionHeader: React.FC<VersionHeaderProps> = ({
	commitMsg,
	commitHash,
	createdAt,
	authorName,
}) => {
	return (
		<div>
			<div className="text-xl leading-5 font-medium mb-6 text-foreground">
				{commitMsg}
			</div>
			<div className="flex items-center space-x-2.5 text-sm text-muted-foreground">
				<span className="text-xs font-medium px-2.5 py-0 rounded-sm border border-border text-foreground">
					{commitHash ? commitHash.substring(0, 8) : ""}
				</span>
				<span>{formatUserLocalDateTime(createdAt)}</span>
				<span>by {authorName}</span>
			</div>
		</div>
	);
};
