import type React from "react";
import { GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/searchInput";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface VersionsToolbarProps {
	onCommitClick: () => void;
	onCompareClick: () => void;
	isCommitDisabled: boolean;
	searchValue: string;
	onSearchChange: (value: string) => void;
}

export const VersionsToolbar: React.FC<VersionsToolbarProps> = ({
	onCommitClick,
	onCompareClick,
	isCommitDisabled,
	searchValue,
	onSearchChange,
}) => {
	return (
		<div className="flex items-center justify-between">
			<div className="flex items-center gap-3">
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								className="px-7 w-[86px]"
								onClick={onCommitClick}
								disabled={isCommitDisabled}
							>
								Commit
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Save prompt changes</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								className="px-4 h-[36px] flex items-center gap-2"
								onClick={onCompareClick}
							>
								<GitCompare className="size-4" />
								Compare
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Compare prompt versions</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>

			<div className="flex items-center gap-3">
				<SearchInput
					placeholder="Search..."
					className="min-w-[252px] h-[36px]"
					value={searchValue}
					onChange={(e) => onSearchChange(e.target.value)}
				/>
			</div>
		</div>
	);
};
