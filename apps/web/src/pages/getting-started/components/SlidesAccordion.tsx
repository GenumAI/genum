import { memo } from "react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { SlideCard } from "./SlideCard";
import type { GettingStartedSection } from "../types";

interface SlidesAccordionProps {
	sections: GettingStartedSection[];
	activeId: string;
	onSelect: (id: string) => void;
}

function SlidesAccordionComponent({ sections, activeId, onSelect }: SlidesAccordionProps) {
	return (
		<Accordion type="single" collapsible defaultValue={sections[0]?.id} className="w-full space-y-0">
			{sections.map((section) => (
				<AccordionItem key={section.id} value={section.id} className="border-none mt-0">
					<AccordionTrigger className="text-[14px] font-bold text-foreground h-[36px] [&>svg]:hidden">
						{section.title}
					</AccordionTrigger>
					<AccordionContent className="p-0">
						<nav className="space-y-[14px] mb-6">
							{section.slides.map((slide) => (
								<SlideCard
									key={slide.id}
									slide={slide}
									isActive={slide.id === activeId}
									onSelect={onSelect}
								/>
							))}
						</nav>
					</AccordionContent>
				</AccordionItem>
			))}
		</Accordion>
	);
}

export const SlidesAccordion = memo(SlidesAccordionComponent);
