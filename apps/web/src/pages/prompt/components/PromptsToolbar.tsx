import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/searchInput";
import { PlusCircle } from "lucide-react";

type PromptsToolbarProps = {
	search: string;
	onSearchChange: (value: string) => void;
	onCreatePrompt: () => void;
	isCreating: boolean;
};

export function PromptsToolbar({
	search,
	onSearchChange,
	onCreatePrompt,
	isCreating,
}: PromptsToolbarProps) {
	return (
		<div className="flex justify-between items-center">
			<div className="flex gap-3">
				<SearchInput
					placeholder="Search..."
					className="min-w-[241px]"
					value={search}
					onChange={(e) => onSearchChange(e.target.value)}
				/>
			</div>
			<Button onClick={onCreatePrompt} disabled={isCreating} className="min-w-[186px]">
				<PlusCircle className="mr-2 h-4 w-4" />
				Create prompt
			</Button>
		</div>
	);
}
