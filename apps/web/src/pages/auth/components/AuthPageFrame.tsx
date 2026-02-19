import type { PropsWithChildren } from "react";

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
		"flex flex-col gap-6 w-[400px] shadow-[0_4px_16px_#00000014] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] rounded-[24px] p-[52px] bg-white dark:bg-zinc-900 dark:border dark:border-zinc-800";

	return (
		<div
			className="fixed inset-0 w-full h-full bg-cover bg-center bg-no-repeat flex items-center justify-center dark:bg-zinc-950"
			style={{ backgroundImage: `url('${backgroundImage}')` }}
		>
			<div className={cardClassName ? `${defaultCardClassName} ${cardClassName}` : defaultCardClassName}>
				<div className="text-center">
					<div className="mx-auto flex h-[32px] w-[140px] items-center justify-center">
						<img
							src={logoSrc}
							alt="Logo"
							className="max-h-full max-w-full object-contain object-center dark:invert-0"
						/>
					</div>
					<h1 className="text-[24px] font-bold text-gray-900 dark:text-zinc-50 mb-[16px] mt-[24px]">
						{title}
					</h1>
					<p className="text-gray-800 dark:text-zinc-400 text-[14px]">{description}</p>
				</div>
				{children}
			</div>
		</div>
	);
}
