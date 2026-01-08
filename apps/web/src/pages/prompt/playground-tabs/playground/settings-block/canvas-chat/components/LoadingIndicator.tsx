import React from "react";

export const LoadingIndicator = React.memo(() => {
	return (
		<div className="flex justify-start">
			<div className="px-3 py-2 text-sm">
				<div className="flex space-x-1">
					<div className="w-2 h-2 bg-[#71717A] rounded-full animate-bounce"></div>
					<div
						className="w-2 h-2 bg-[#71717A] rounded-full animate-bounce"
						style={{ animationDelay: "0.1s" }}
					></div>
					<div
						className="w-2 h-2 bg-[#71717A] rounded-full animate-bounce"
						style={{ animationDelay: "0.2s" }}
					></div>
				</div>
			</div>
		</div>
	);
});

LoadingIndicator.displayName = "LoadingIndicator";
