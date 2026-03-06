import { useCallback, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { useOrgModels } from "../hooks/useOrgModels";
import { ModelsTable } from "./OrgModels/ModelsTable";
import { DeleteConfirmDialog } from "./shared/DeleteConfirmDialog";

export default function OrgModels() {
	const { models, isLoading, toggleModel, pendingModelIds } = useOrgModels();
	const [modelIdPendingDisableConfirmation, setModelIdPendingDisableConfirmation] = useState<
		number | null
	>(null);

	const enabledModelsCount = useMemo(
		() => models.filter((model) => model.enabled !== false).length,
		[models],
	);

	const handleConfirmDisableAll = useCallback(() => {
		if (modelIdPendingDisableConfirmation === null) {
			return;
		}

		toggleModel({ modelId: modelIdPendingDisableConfirmation, enabled: false });
		setModelIdPendingDisableConfirmation(null);
	}, [modelIdPendingDisableConfirmation, toggleModel]);

	const handleToggle = useCallback((modelId: number, enabled: boolean) => {
		const isDisablingLastEnabledModel = !enabled && enabledModelsCount === 1;

		if (isDisablingLastEnabledModel) {
			setModelIdPendingDisableConfirmation(modelId);
			return;
		}

		toggleModel({ modelId, enabled });
	}, [enabledModelsCount, toggleModel]);

	return (
		<>
			<Card className="rounded-md shadow-none">
				<CardHeader>
					<CardTitle className="text-[18px] font-medium dark:text-[#fff] text-[#18181B]">
						Models
					</CardTitle>
					<CardDescription className="text-sm text-muted-foreground">
						Control which AI models are available for use in your organization. Disabled
						models will not appear in the model selector.
					</CardDescription>
				</CardHeader>

				<CardContent className="p-6 pt-0">
					<ModelsTable
						models={models}
						isLoading={isLoading}
						pendingModelIds={pendingModelIds}
						onToggle={handleToggle}
					/>
				</CardContent>
			</Card>

			<DeleteConfirmDialog
				open={modelIdPendingDisableConfirmation !== null}
				onOpenChange={(open) => {
					if (!open) {
						setModelIdPendingDisableConfirmation(null);
					}
				}}
				onConfirm={handleConfirmDisableAll}
				title="Disable all models?"
				description="Are you sure you want to disable the ability to use all models in this organization? You will not be able to run prompts or testcases"
				confirmText="Disable models"
				cancelText="Cancel"
				isDeleting={false}
			/>
		</>
	);
}
