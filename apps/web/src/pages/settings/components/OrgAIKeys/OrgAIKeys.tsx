import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAIKeys } from "../../hooks/useAIKeys";
import { useCustomProvider } from "../../hooks/useCustomProvider";
import { SettingsTab } from "../../utils/types";
import { QuotaCard } from "./QuotaCard";
import { StandardKeysSection } from "./StandardKeysSection";
import { CustomProviderSection } from "./CustomProviderSection";

export default function OrgAIKeys() {
	const [activeTab, setActiveTab] = useState<string>(SettingsTab.PROVIDERS);
	const {
		keys,
		isLoading: isLoadingKeys,
		quota,
		isLoadingQuota,
		createKey,
		deleteKey,
	} = useAIKeys();
	const {
		provider: customProvider,
		isLoading: isLoadingProvider,
		isSyncing,
		deleteStatus,
		deleteStatusError,
		isCheckingDeleteStatus,
		fetchProvider,
		syncModels,
		deleteProvider,
		checkDeleteStatus,
	} = useCustomProvider();

	return (
		<Card className="rounded-md shadow-none">
			<QuotaCard quota={quota} isLoading={isLoadingQuota} />

			<CardHeader className="flex items-center justify-between flex-row">
				<CardTitle className="text-[18px] font-medium dark:text-[#fff] text-[#18181B]">
					LLM Provider Keys
				</CardTitle>
			</CardHeader>

			<CardContent className="p-6 pt-0">
				<Tabs value={activeTab} onValueChange={setActiveTab}>
					<TabsList className="bg-muted rounded-xl p-1 gap-1 w-fit">
						<TabsTrigger value={SettingsTab.PROVIDERS}>Global</TabsTrigger>
						<TabsTrigger value={SettingsTab.CUSTOM}>Custom</TabsTrigger>
					</TabsList>

					<TabsContent value={SettingsTab.PROVIDERS} className="mt-4">
						<StandardKeysSection
							keys={keys}
							isLoading={isLoadingKeys}
							onAddKey={createKey}
							onDeleteKey={deleteKey}
						/>
					</TabsContent>

					<TabsContent value={SettingsTab.CUSTOM} className="mt-4">
						<CustomProviderSection
							provider={customProvider}
							isLoading={isLoadingProvider}
							isSyncing={isSyncing}
							deleteStatus={deleteStatus}
							deleteStatusError={deleteStatusError}
							isCheckingDeleteStatus={isCheckingDeleteStatus}
							onSync={syncModels}
							onDelete={deleteProvider}
							onCheckDeleteStatus={checkDeleteStatus}
							onProviderSaved={fetchProvider}
						/>
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	);
}
