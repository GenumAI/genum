import type React from "react";
import { XIcon  } from "@phosphor-icons/react";

export type FilterChip = {
	key: string | number;
	label: string;
	onRemove: () => void;
};

const ActiveFilterChips: React.FC<{
	chips: { key: string; label: string; onRemove: () => void }[];
}> = ({ chips }) => (
	<div className="flex items-center gap-2 overflow-x-auto">
		{chips.map((chip) => (
			<button
				type="button"
				key={chip.key}
				className="flex items-center gap-1 px-4 py-2 text-sm bg-muted rounded-full whitespace-nowrap"
				onClick={chip.onRemove}
			>
				<span className="whitespace-nowrap">{chip.label}</span>
				<XIcon className="ml-1 rotate-65" />
			</button>
		))}
	</div>
);

export default ActiveFilterChips;
