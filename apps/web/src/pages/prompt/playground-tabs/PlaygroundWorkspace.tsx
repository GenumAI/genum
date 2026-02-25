import type { ComponentType } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import Playground from "@/pages/prompt/playground-tabs/playground/Playground";
import PromptTestcases from "@/pages/prompt/playground-tabs/testcases/Testcases";
import Versions from "@/pages/prompt/playground-tabs/version/Versions";
import Memory from "@/pages/prompt/playground-tabs/memory/Memory";
import Logs from "@/pages/prompt/playground-tabs/logs/LogsTab";
import Api from "@/pages/prompt/playground-tabs/api/Api";

type WorkspaceTab = "playground" | "testcases" | "versions" | "memory" | "logs" | "api";

const WORKSPACE_TAB_ORDER: WorkspaceTab[] = [
	"playground",
	"testcases",
	"versions",
	"memory",
	"logs",
	"api",
];

const DEFAULT_TAB: WorkspaceTab = "playground";

const WORKSPACE_TAB_COMPONENTS: Record<WorkspaceTab, ComponentType> = {
	playground: Playground,
	testcases: PromptTestcases,
	versions: Versions,
	memory: Memory,
	logs: Logs,
	api: Api,
};

function isWorkspaceTab(value: string | undefined): value is WorkspaceTab {
	return WORKSPACE_TAB_ORDER.includes(value as WorkspaceTab);
}

function buildPromptTabPath({
	orgId,
	projectId,
	promptId,
	tab,
	search,
}: {
	orgId?: string;
	projectId?: string;
	promptId: string;
	tab: WorkspaceTab;
	search?: string;
}) {
	const workspacePrefix = [orgId, projectId].filter(Boolean).join("/");
	const basePath = workspacePrefix
		? `/${workspacePrefix}/prompt/${promptId}/${tab}`
		: `/prompt/${promptId}/${tab}`;

	return `${basePath}${search || ""}`;
}

export default function PlaygroundWorkspace() {
	const { orgId, projectId, id, tab } = useParams<{
		orgId: string;
		projectId: string;
		id: string;
		tab: string;
	}>();
	const location = useLocation();
	const normalizedTab = isWorkspaceTab(tab) ? tab : DEFAULT_TAB;
	const activeTab = normalizedTab;

	if (!id) {
		return null;
	}

	if (!isWorkspaceTab(tab)) {
		return (
			<Navigate
				replace
				to={buildPromptTabPath({
					orgId,
					projectId,
					promptId: id,
					tab: DEFAULT_TAB,
					search: location.search,
				})}
			/>
		);
	}

	return (
		<div className="w-full min-w-0">
			{WORKSPACE_TAB_ORDER.map((tabName) => {
				const TabComponent = WORKSPACE_TAB_COMPONENTS[tabName];
				const isActive = tabName === activeTab;

				return (
					<div
						key={tabName}
						className="w-full min-w-0 justify-center"
						data-workspace-tab={tabName}
						aria-hidden={!isActive}
						style={{ display: isActive ? "flex" : "none" }}
					>
						<TabComponent />
					</div>
				);
			})}
		</div>
	);
}
