import React from "react";

export const LoadingIndicator = React.memo(() => {
	return (
		<div className="flex justify-start">
			<div className="px-3 py-2 text-sm">
				<div className="flex space-x-1">
					<div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"></div>
					<div
						className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
						style={{ animationDelay: "0.1s" }}
					></div>
					<div
						className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
						style={{ animationDelay: "0.2s" }}
					></div>
				</div>
			</div>
		</div>
	);
});

LoadingIndicator.displayName = "LoadingIndicator";
