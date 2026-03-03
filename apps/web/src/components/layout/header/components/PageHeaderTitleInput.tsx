import type { KeyboardEvent } from "react";

interface PageHeaderTitleInputProps {
	value: string;
	className: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	onCancel: () => void;
}

export function PageHeaderTitleInput({
	value,
	className,
	onChange,
	onSubmit,
	onCancel,
}: PageHeaderTitleInputProps) {
	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") {
			event.preventDefault();
			onSubmit();
			return;
		}

		if (event.key === "Escape") {
			event.preventDefault();
			onCancel();
		}
	};

	return (
		<input
			value={value}
			onChange={(event) => onChange(event.target.value)}
			onBlur={onSubmit}
			onKeyDown={handleKeyDown}
			className={className}
		/>
	);
}
