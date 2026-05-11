import * as React from "react";

import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

const SearchInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
	({ className, type, ...props }, ref) => {
		return (
			<div className="relative w-full">
				<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
					<Search className="h-4 w-4" />
				</span>
				<input
					type={type}
					className={cn(
						"flex h-9 w-full rounded-md border border-input bg-[hsl(var(--field-background))] pl-9 pr-3 py-1 text-base text-foreground shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
						className,
					)}
					ref={ref}
					{...props}
				/>
			</div>
		);
	},
);
SearchInput.displayName = "Input";

export { SearchInput };
