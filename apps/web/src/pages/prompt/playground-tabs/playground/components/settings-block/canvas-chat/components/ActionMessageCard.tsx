import React from "react";

interface ActionMessageCardProps {
	title: string;
	description: string;
}

export const ActionMessageCard = React.memo<ActionMessageCardProps>(({ title, description }) => {
	return (
		<div className="mt-3 w-full rounded-xl p-3 bg-muted border border-border text-left hover:bg-muted/80 transition-colors">
			<div className="text-xs font-semibold text-foreground">{title}</div>
			<div className="text-[10px] text-muted-foreground">{description}</div>
		</div>
	);
});

ActionMessageCard.displayName = "ActionMessageCard";
