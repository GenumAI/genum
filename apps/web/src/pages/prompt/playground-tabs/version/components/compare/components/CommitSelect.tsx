import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { CommitSelectProps } from "../types";

export const CommitSelect = ({ value, onChange, versions, placeholder }: CommitSelectProps) => (
	<Select value={value} onValueChange={onChange}>
		<SelectTrigger className="h-[36px] w-full md:w-[314px] text-[14px]">
			<SelectValue placeholder={placeholder} />
		</SelectTrigger>
		<SelectContent className="text-[14px] w-full min-w-0 md:min-w-[314px] max-h-[288px] overflow-y-auto">
			<SelectItem value="current">Current prompt</SelectItem>
			{versions.map((v) => (
				<SelectItem key={v.id} value={v.id.toString()}>
					<div className="flex items-center justify-between gap-2 w-full min-w-0">
						<div
							className="flex truncate max-w-[180px] md:max-w-[200px]"
							title={v.commitMsg}
						>
							{v.commitMsg}
						</div>
						<div className="flex items-center rounded-[2px] px-1 h-[20px] justify-center text-[#2E9D2A] bg-[#2E9D2A] border border-[#2E9D2A] bg-opacity-[8%]">
							{v.branchName}
						</div>
					</div>
				</SelectItem>
			))}
		</SelectContent>
	</Select>
);
