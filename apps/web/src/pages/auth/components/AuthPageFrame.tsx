import type { PropsWithChildren } from "react";
import { isCssVariableImage, resolveBackgroundImage } from "@/pages/invite/utils/inviteThemeAssets";

type AuthPageFrameProps = PropsWithChildren<{
	backgroundImage: string;
	logoSrc: string;
	title: string;
	description: string;
	cardClassName?: string;
}>;

export function AuthPageFrame({
	backgroundImage,
	logoSrc,
	title,
	description,
	cardClassName,
	children,
}: AuthPageFrameProps) {
	const defaultCardClassName =
		"flex w-[400px] flex-col gap-6 rounded-[24px] border border-border bg-card/95 p-[52px] text-card-foreground shadow-2xl backdrop-blur-sm";

	return (
		<div
			className="fixed inset-0 flex h-full w-full items-center justify-center bg-background bg-cover bg-center bg-no-repeat"
			style={{ backgroundImage: resolveBackgroundImage(backgroundImage) }}
		>
			<div
				className={
					cardClassName
						? `${defaultCardClassName} ${cardClassName}`
						: defaultCardClassName
				}
			>
				<div className="text-center">
					<div className="mx-auto flex h-[32px] w-[140px] items-center justify-center">
						{isCssVariableImage(logoSrc) ? (
							<div
								role="img"
								aria-label="Logo"
								className="h-full w-full bg-contain bg-center bg-no-repeat"
								style={{ backgroundImage: logoSrc }}
							/>
						) : (
							<img
								src={logoSrc}
								alt="Logo"
								className="max-h-full max-w-full object-contain object-center"
							/>
						)}
					</div>
					<h1 className="mb-[16px] mt-[24px] text-[24px] font-bold text-foreground">
						{title}
					</h1>
					<p className="text-[14px] text-muted-foreground">{description}</p>
				</div>
				{children}
			</div>
		</div>
	);
}
