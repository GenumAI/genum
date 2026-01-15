import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CircleAlert } from "lucide-react";
import type { SchemaOptionsProps } from "../hooks/types";

export const SchemaOptions = ({
	schema,
	onChange,
	showCoT,
	showStatus,
	onStrictToggle,
}: SchemaOptionsProps) => {
	return (
		<div className="flex gap-6 items-center">
			<div className="flex items-center space-x-2">
				<Checkbox
					checked={schema.strict}
					onCheckedChange={onStrictToggle}
					id="strict-mode"
				/>
				<label htmlFor="strict-mode" className="text-sm cursor-pointer">
					Strict Mode
				</label>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<CircleAlert className="w-4 h-4" />
						</TooltipTrigger>
						<TooltipContent className="max-w-xs whitespace-normal" sideOffset={5}>
							When enabled, only properties defined in the schema will be allowed in
							the output
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>

			{showCoT && (
				<div className="flex items-center space-x-2">
					<Checkbox
						checked={schema.chainOfThoughts}
						onCheckedChange={(v) =>
							onChange({ ...schema, chainOfThoughts: v === true })
						}
						id="chain-of-thoughts"
					/>
					<label htmlFor="chain-of-thoughts" className="text-sm cursor-pointer">
						Chain Of Thoughts
					</label>

					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<CircleAlert className="w-4 h-4" />
							</TooltipTrigger>
							<TooltipContent className="max-w-xs whitespace-normal" sideOffset={5}>
								When enabled, the model will generate and return a step-by-step
								reasoning process along with the output. This feature can increase
								the cost of the request.
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
			)}

			{showStatus && (
				<div className="flex items-center space-x-2">
					<Checkbox
						checked={schema.promptStatus}
						onCheckedChange={(v) => onChange({ ...schema, promptStatus: v === true })}
						id="prompt-status"
					/>
					<label htmlFor="prompt-status" className="text-sm cursor-pointer">
						Prompt Status
					</label>

					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<CircleAlert className="w-4 h-4" />
							</TooltipTrigger>
							<TooltipContent className="max-w-xs whitespace-normal" sideOffset={5}>
								When enabled, the model will return the execution status of the
								prompt. This feature works only in testcase mode and can increase
								the cost of the request.
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
			)}
		</div>
	);
};
