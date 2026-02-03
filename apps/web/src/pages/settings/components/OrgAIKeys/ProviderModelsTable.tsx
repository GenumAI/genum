import { useState, useCallback, useEffect } from "react";
import { Settings } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { organizationApi } from "@/api/organization";
import type { LanguageModel } from "@/api/organization";
import {
	Table,
	TableHeader,
	TableHead,
	TableBody,
	TableRow,
	TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { ProviderModelsTableProps } from "../../utils/types";
import ModelConfigDialog from "../dialogs/ModelConfigDialog";

export function ProviderModelsTable({ providerId: _providerId }: ProviderModelsTableProps) {
	const { toast } = useToast();
	const [models, setModels] = useState<LanguageModel[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [configDialogOpen, setConfigDialogOpen] = useState(false);
	const [selectedModel, setSelectedModel] = useState<LanguageModel | null>(null);

	const fetchModels = useCallback(async () => {
		try {
			setIsLoading(true);
			const data = await organizationApi.getProviderModels();
			setModels(data.models);
		} catch (error) {
			console.error(error);
			toast({
				title: "Error",
				description: "Failed to load models",
				variant: "destructive",
			});
		} finally {
			setIsLoading(false);
		}
	}, [toast]);

	useEffect(() => {
		fetchModels();
	}, [fetchModels]);

	const openConfigDialog = (model: LanguageModel) => {
		setSelectedModel(model);
		setConfigDialogOpen(true);
	};

	const handleModelUpdated = () => {
		fetchModels();
	};

	if (isLoading) {
		return <div className="text-sm text-muted-foreground">Loading models...</div>;
	}

	if (models.length === 0) {
		return (
			<div className="text-sm text-muted-foreground">
				No models synced yet. Models sync automatically when you save the provider.
			</div>
		);
	}

	return (
		<div>
			<div className="border rounded-md">
				<Table>
					<TableHeader className="bg-muted/50">
						<TableRow>
							<TableHead className="text-left p-3">Model</TableHead>
							<TableHead className="text-left p-3">Display Name</TableHead>
							<TableHead className="w-[100px] text-center p-3">Config</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{models.map((model) => (
							<TableRow key={model.id}>
								<TableCell className="p-3 font-mono text-sm">
									{model.name}
								</TableCell>
								<TableCell className="p-3">
									{model.displayName || model.name}
								</TableCell>
								<TableCell className="text-center p-3">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => openConfigDialog(model)}
									>
										<Settings className="h-4 w-4" />
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>

			{selectedModel && (
				<ModelConfigDialog
					model={selectedModel}
					open={configDialogOpen}
					onOpenChange={setConfigDialogOpen}
					onSaved={handleModelUpdated}
				/>
			)}
		</div>
	);
}
