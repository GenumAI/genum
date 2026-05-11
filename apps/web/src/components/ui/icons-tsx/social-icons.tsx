import { LinkedInIcon } from "@/assets/linkedin-icon";
import { TwitterIcon } from "@/assets/twitter-icon";
import { YouTubeIcon } from "@/assets/youtube-icon";

export function SocialIcons() {
	return (
		<div
			className="flex justify-center gap-2 px-2 py-3
     group-data-[collapsible=icon]:opacity-0
     group-data-[collapsible=icon]:scale-95
     group-data-[collapsible=icon]:pointer-events-none
     transition-all duration-300 ease-in-out"
		>
			<a
				href="https://www.linkedin.com/company/genum-ai/"
				target="_blank"
				rel="noreferrer"
				className="flex h-6 w-6 items-center justify-center text-foreground transition-colors hover:text-brand"
			>
				<LinkedInIcon />
			</a>
			<a
				href="https://x.com/genum_ai"
				target="_blank"
				rel="noreferrer"
				className="flex h-6 w-6 items-center justify-center text-foreground transition-colors hover:text-brand"
			>
				<TwitterIcon />
			</a>
			<a
				href="https://www.youtube.com/@Genum-ai"
				target="_blank"
				rel="noreferrer"
				className="flex h-6 w-6 items-center justify-center text-foreground transition-colors hover:text-brand"
			>
				<YouTubeIcon />
			</a>
		</div>
	);
}
