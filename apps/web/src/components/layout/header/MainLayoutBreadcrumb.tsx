import { Link } from "react-router-dom";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type MainLayoutBreadcrumbProps = {
	pathnames: string[];
	orgId?: string;
	projectId?: string;
	promptId?: string;
	promptName?: string;
	versionId?: string;
	versionCommitMessage?: string;
	isRefetchingVersion: boolean;
	notificationId?: string;
	notificationTitle?: string;
	testcaseId?: string | null;
	testcaseName?: string | null;
};

const breadcrumbMap: Record<string, { label: string; path?: string }> = {
	prompt: { label: "Prompts", path: "prompts" },
	prompts: { label: "Prompts", path: "prompts" },
};

const truncateLabel = (text: string) => {
	return text.length > 50 ? `${text.substring(0, 50)}...` : text;
};

const getBreadcrumbHref = (
	segments: string[],
	index: number,
	orgId?: string,
	projectId?: string,
): string => {
	const orgIdSegment = orgId || "";
	const projectIdSegment = projectId || "";

	const actualSegments = segments.slice(0, index + 1).map((segment, segmentIndex) => {
		if (segment === "prompts" && segments[segmentIndex + 1]?.match(/^\d+$/)) {
			return "prompt";
		}
		if (segment === "prompts") {
			return "prompts";
		}
		return breadcrumbMap[segment]?.path || segment;
	});

	return `/${orgIdSegment}/${projectIdSegment}/${actualSegments.join("/")}`;
};

export function MainLayoutBreadcrumb({
	pathnames,
	orgId,
	projectId,
	promptId,
	promptName,
	versionId,
	versionCommitMessage,
	isRefetchingVersion,
	notificationId,
	notificationTitle,
	testcaseId,
	testcaseName,
}: MainLayoutBreadcrumbProps) {
	return (
		<Breadcrumb>
			<BreadcrumbList>
				{pathnames.slice(2).map((segment, index, localArray) => {
					const mapped = breadcrumbMap[segment];
					const isLast = index === localArray.length - 1;

					let label: string;
					if (segment.toLowerCase() === "api") {
						label = "API";
					} else if (segment.toLowerCase() === "org") {
						label = "Organization";
					} else if (segment.toLowerCase() === "ai-keys") {
						label = "LLM API Keys";
					} else if (segment.toLowerCase() === "api-keys") {
						label = "API Keys";
					} else if (segment === promptId && promptName) {
						label = promptName;
					} else if (
						versionCommitMessage &&
						segment === versionId &&
						!isRefetchingVersion
					) {
						label = versionCommitMessage;
					} else if (segment === notificationId && notificationTitle) {
						label = notificationTitle;
					} else {
						label = mapped?.label || segment.charAt(0).toUpperCase() + segment.slice(1);
					}

					const href = getBreadcrumbHref(localArray, index, orgId, projectId);

					let finalHref = href;
					if (
						href.includes("/prompts/") &&
						/^\/(?:[^/]+\/)?(?:[^/]+\/)?prompts\/\d+/.test(href)
					) {
						finalHref = href.replace("/prompts/", "/prompt/");
					}

					const pathWithoutQuery = finalHref.split("?")[0];
					if (/^\/(?:[^/]+\/)?(?:[^/]+\/)?prompt\/\d+$/.test(pathWithoutQuery)) {
						finalHref = `${pathWithoutQuery}/playground`;
					}

					if (/\/settings\/user$/.test(pathWithoutQuery)) {
						finalHref = `${finalHref}/profile`;
					}
					if (/\/settings\/org$/.test(pathWithoutQuery)) {
						finalHref = `${finalHref}/details`;
					}
					if (/\/settings\/project$/.test(pathWithoutQuery)) {
						finalHref = `${finalHref}/details`;
					}

					const itemKey = `${index}-${segment}-${finalHref || label}`;

					return (
						<div key={itemKey} className="flex items-center gap-2">
							{index !== 0 && <BreadcrumbSeparator />}
							<BreadcrumbItem>
								{isLast ? (
									<BreadcrumbPage>{truncateLabel(label)}</BreadcrumbPage>
								) : (
									<BreadcrumbLink asChild>
										<Link to={finalHref}>{truncateLabel(label)}</Link>
									</BreadcrumbLink>
								)}
							</BreadcrumbItem>
						</div>
					);
				})}
				{testcaseId && testcaseName && (
					<div className="flex items-center gap-2">
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage>{truncateLabel(testcaseName)}</BreadcrumbPage>
						</BreadcrumbItem>
					</div>
				)}
			</BreadcrumbList>
		</Breadcrumb>
	);
}
