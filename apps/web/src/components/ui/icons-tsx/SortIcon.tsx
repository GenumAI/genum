import { CaretDown, CaretUp } from "phosphor-react";

interface SortIconProps {
	isSorted: false | "asc" | "desc";
}

const dimClass = "opacity-30";

const SortIcon = ({ isSorted }: SortIconProps) => {
	if (isSorted === "asc") {
		return (
			<span className="ml-1 flex flex-col">
				<CaretUp size={12} weight="bold" className="text-foreground" />
				<CaretDown size={12} weight="bold" className={`-mt-1 ${dimClass}`} />
			</span>
		);
	}

	if (isSorted === "desc") {
		return (
			<span className="ml-1 flex flex-col">
				<CaretUp size={12} weight="bold" className={dimClass} />
				<CaretDown size={12} weight="bold" className={`-mt-1 text-foreground`} />
			</span>
		);
	}

	return (
		<span className="ml-1 flex flex-col opacity-50">
			<CaretUp size={12} weight="bold" />
			<CaretDown size={12} weight="bold" className="-mt-1" />
		</span>
	);
};

export default SortIcon;
