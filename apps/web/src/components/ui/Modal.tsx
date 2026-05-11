import React, { forwardRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ModalProps {
	title: string | ReactNode;
	closeItem?: ReactNode;
	children: ReactNode;
	className?: string;
}

const Modal = forwardRef<HTMLDivElement, ModalProps>(
	({ title, closeItem, children, className }: ModalProps, ref) => {
		return (
			<div
				ref={ref}
				className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
			>
				<div
					className={cn(
						"flex h-full max-h-[90vh] w-full max-w-7xl flex-col rounded-lg border border-border bg-card text-card-foreground shadow-2xl",
						className,
					)}
				>
					<div className="flex items-center justify-between mb-3">
						{typeof title === "string" ? (
							<h2 className="text-lg font-semibold">{title}</h2>
						) : (
							title
						)}
						{closeItem}
					</div>

					{children}
				</div>
			</div>
		);
	},
);

export default Modal;
