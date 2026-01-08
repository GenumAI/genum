import React from "react";
import { DEFAULT_CHAT_OPTIONS } from "../utils/constants";

interface DefaultOptionsProps {
	onOptionClick: (text: string) => void;
}

export const DefaultOptions = React.memo<DefaultOptionsProps>(({ onOptionClick }) => {
	return (
		<div className="flex flex-col gap-2.5 mt-3">
			{DEFAULT_CHAT_OPTIONS.map((option, index) => (
				<button
					key={index}
					className="rounded-xl p-3 bg-muted border border-border text-left hover:bg-muted/80 transition-colors"
					onClick={() => onOptionClick(option.text)}
				>
					<div className="text-xs font-semibold text-foreground">{option.text}</div>
					<div className="text-[10px] text-muted-foreground">{option.description}</div>
				</button>
			))}
		</div>
	);
});

DefaultOptions.displayName = "DefaultOptions";
