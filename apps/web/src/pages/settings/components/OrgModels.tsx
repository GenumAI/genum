import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { useOrgModels } from "../hooks/useOrgModels";
import { ModelsTable } from "./OrgModels/ModelsTable";

export default function OrgModels() {
	const { models, isLoading, toggleModel, isToggling } = useOrgModels();

	const handleToggle = (modelId: number, enabled: boolean) => {
		toggleModel({ modelId, enabled });
	};

	return (
		<Card className="rounded-md shadow-none">
			<CardHeader>
				<CardTitle className="text-[18px] font-medium dark:text-[#fff] text-[#18181B]">
					Models
				</CardTitle>
				<CardDescription className="text-sm text-muted-foreground">
					Control which AI models are available for use in your organization. Disabled models
					will not appear in the model selector.
				</CardDescription>
			</CardHeader>

			<CardContent className="p-6 pt-0">
				<ModelsTable
					models={models}
					isLoading={isLoading}
					isToggling={isToggling}
					onToggle={handleToggle}
				/>
			</CardContent>
		</Card>
	);
}
