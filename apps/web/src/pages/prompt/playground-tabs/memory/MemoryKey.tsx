import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import CreateMemoryDialog from "@/components/dialogs/CreateMemoryDialog";
import { PlusCircle, Inbox, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Memory } from "@/api/prompt/prompt.api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMemoryKey } from "./hooks/useMemoryKey";

interface MemoryKeyProps {
	promptId: number;
}

const MemoryKey = ({ promptId }: MemoryKeyProps) => {
	const {
		selectedKey,
		memoryValue,
		memories,
		isPending,
		createMemoryModalOpen,
		setCreateMemoryModalOpen,
		isOpenMemory,
		setIsOpenMemory,
		displayMemoryName,
		selectedKeyName,
		onValueChange,
		onBlurHandler,
		onSelectKeyHandler,
		clearSelectedMemory,
		createMemoryHandler,
	} = useMemoryKey(promptId);

	return (
		<>
			<Popover open={isOpenMemory} onOpenChange={setIsOpenMemory}>
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<PopoverTrigger asChild>
								<button type="button" className="w-[130px] h-[32px] px-3 rounded-md transition-colors flex items-center gap-2 hover:bg-muted/20">
									<h2 className="text-[#18181B] dark:text-[#FFFFFF] text-[12px] not-italic font-bold flex-shrink-0">
										Memory:
									</h2>
									<span className="flex-1 min-w-0 text-[#71717A] dark:text-[#FFFFFFBF] text-[12px] font-normal truncate">
										{displayMemoryName || "Select"}
									</span>
								</button>
							</PopoverTrigger>
						</TooltipTrigger>
						<TooltipContent>
							<p>Choose extra runtime context</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
				<PopoverContent className="w-[400px] rounded-xl p-4" align="start">
					<div className="space-y-4">
						<h3 className="text-[#09090B] dark:text-[#FFFFFF] text-[14px] font-bold">
							Memory
						</h3>
						<div className="flex flex-col gap-2 mb-1">
							<div className="relative group">
								<Select value={selectedKey} onValueChange={onSelectKeyHandler}>
									<SelectTrigger className="text-sm font-normal leading-5 text-muted-foreground w-full">
										<SelectValue placeholder="Select">
											{selectedKeyName}
										</SelectValue>
									</SelectTrigger>

									<SelectContent className="space-y-1 text-sm font-normal leading-5 w-full">
										<div className="p-2">
											{memories &&
												memories.length > 0 &&
												memories.map((item: Memory) => (
													<SelectItem
														key={item.id}
														value={String(item.id)}
													>
														{item.key}
													</SelectItem>
												))}

											{(!memories || memories.length === 0) && (
												<div className="flex w-full items-center justify-center rounded-xl border border-dashed border-border p-4 shadow-sm bg-card">
													<div className="flex flex-col items-center gap-4 text-muted-foreground">
														<div className="p-4 rounded-xl border border-border shadow-md bg-card">
															<Inbox
																className="h-6 w-6"
																strokeWidth={1.5}
															/>
														</div>
														<span className="text-base font-medium tracking-wide">
															No data
														</span>
													</div>
												</div>
											)}

											<div className="m-1 mt-2">
												<Button
													type="button"
													variant="secondary"
													size="sm"
													className="w-full justify-center gap-2 text-sm"
													onClick={(e) => {
														e.stopPropagation();
														setCreateMemoryModalOpen(true);
													}}
												>
													<PlusCircle className="h-4 w-4" />
													Create memory
												</Button>
											</div>
										</div>
									</SelectContent>
								</Select>

								{selectedKey && (
									<button
										type="button"
										onClick={clearSelectedMemory}
										aria-label="Clear selected memory"
										className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors z-10
                                            bg-muted hover:bg-accent text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100"
									>
										<X className="h-4 w-4" />
									</button>
								)}
							</div>

							{selectedKey && (
								<>
									<p className="text-xs font-medium mt-2 text-foreground">
										Memory Value
									</p>
									<Textarea
										placeholder="Enter memory value"
										value={memoryValue}
										onChange={(e) => onValueChange(e.target.value)}
										onBlur={onBlurHandler}
										className="w-full min-h-[180px] max-h-[300px]"
									/>
								</>
							)}
						</div>
					</div>
				</PopoverContent>
			</Popover>

			<CreateMemoryDialog
				open={createMemoryModalOpen}
				setOpen={setCreateMemoryModalOpen}
				confirmationHandler={createMemoryHandler}
				loading={isPending}
			/>
		</>
	);
};

export default MemoryKey;
