import { ChangeEvent, forwardRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/useToast";
import AIPreview from "@/pages/prompt/playground-tabs/playground/components/input-textarea/components/AIPreview";
import { ResizeHandle } from "./ResizeHandle";

interface InputContentProps {
	value: string;
	onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
	onBlur?: () => void;
	isPreviewMode: boolean;
	height: number;
	minHeight?: number;
	onResizeStart: (e: React.MouseEvent) => void;
	showResizeHandle?: boolean;
}

export const InputContent = forwardRef<HTMLTextAreaElement, InputContentProps>(
	(
		{
			value,
			onChange,
			onBlur,
			isPreviewMode,
			height,
			minHeight = 140,
			onResizeStart,
			showResizeHandle = true,
		},
		ref,
	) => {
		const { toast } = useToast();

		return (
			<div className="relative">
				{isPreviewMode ? (
					<div
						className="overflow-y-auto rounded-md border bg-transparent p-4 text-sm dark:border-border"
						style={{ height: `${height}px`, minHeight: `${minHeight}px` }}
					>
						<AIPreview
							content={value}
							onError={(error) => {
								toast({
									title: "Preview Error",
									description: error,
									variant: "destructive",
								});
							}}
						/>
					</div>
				) : (
					<Textarea
						ref={ref}
						value={value}
						onChange={onChange}
						onBlur={onBlur}
						placeholder="Enter your input here..."
						className="resize-none bg-transparent text-[14px] focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 dark:bg-[#1E1E1E] dark:border-border md:text-[14px]"
						style={{ height: `${height}px`, minHeight: `${minHeight}px` }}
					/>
				)}
				{showResizeHandle && <ResizeHandle onResizeStart={onResizeStart} />}
			</div>
		);
	},
);

InputContent.displayName = "InputContent";
