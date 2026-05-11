import React, { memo } from "react";

interface TOCItem {
	id: string;
	level: number;
	text: string;
	anchor: string;
}

interface TableOfContentsProps {
	items: TOCItem[];
	onItemClick: (anchor: string) => void;
	className?: string;
}

const TableOfContents: React.FC<TableOfContentsProps> = memo(
	({ items, onItemClick, className = "" }) => {
		if (items.length === 0) {
			return <div className={`text-sm text-muted-foreground ${className}`}>No headings found</div>;
		}

		const getIndentClass = (level: number) => {
			const indentMap: Record<number, string> = {
				1: "ml-0",
				2: "ml-3",
				3: "ml-6",
				4: "ml-9",
				5: "ml-12",
				6: "ml-16",
			};
			return indentMap[level] || "ml-0";
		};

		const getFontSizeClass = (level: number) => {
			const fontSizeMap: Record<number, string> = {
				1: "text-[17px] py-[8.5px] font-normal border-l border-l-border",
				2: "text-[15px] py-[4px] font-normal border-l border-l-border",
				3: "text-[13px] py-[4px] font-normal border-l border-l-border",
				4: "text-[10px] py-[4px] font-normal border-l border-l-border",
				5: "text-[10px] py-[4px] font-normal border-l border-l-border",
				6: "text-[10px] py-[4px] font-normal border-l border-l-border",
			};
			return fontSizeMap[level] || "text-xs";
		};

		return (
			<div className={`space-y-1.5 ${className}`}>
				<nav className="space-y-1.5 cursor-pointer">
					{items.map((item) => (
						<span
							key={item.id}
							onClick={() => onItemClick(item.anchor)}
							className={`
              block text-muted-foreground text-left transition-colors duration-150 leading-[100%]
              hover:border-l-muted-foreground hover:text-foreground px-2
              ${getIndentClass(item.level)}
              ${getFontSizeClass(item.level)}
            `}
							title={item.text}
						>
							{item.text}
						</span>
					))}
				</nav>
			</div>
		);
	},
);

TableOfContents.displayName = "TableOfContents";

export default TableOfContents;
