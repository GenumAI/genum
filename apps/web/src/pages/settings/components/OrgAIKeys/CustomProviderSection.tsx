import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { PlusCircle, RefreshCw, Edit, Trash2, Loader2, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CustomModelDialog from "../dialogs/CustomModelDialog";
import { DeleteProviderDialog } from "../dialogs/DeleteProviderDialog";
import { ProviderModelsTable } from "./ProviderModelsTable";
import type { CustomProviderSectionProps } from "../../utils/types";
import { getOrgId, getProjectId } from "@/api/client";

export function CustomProviderSection({
	provider,
	isLoading,
	isSyncing,
	deleteStatus,
	deleteStatusError,
	isCheckingDeleteStatus,
	onSync,
	onDelete,
	onCheckDeleteStatus,
	onProviderSaved,
}: CustomProviderSectionProps) {
	const orgId = getOrgId();
	const projectId = getProjectId();
	const [openProviderDialog, setOpenProviderDialog] = useState(false);
	const [deleteProviderDialogOpen, setDeleteProviderDialogOpen] = useState(false);
	const [isDeletingProvider, setIsDeletingProvider] = useState(false);

	useEffect(() => {
		if (deleteProviderDialogOpen) {
			onCheckDeleteStatus();
		}
	}, [deleteProviderDialogOpen, onCheckDeleteStatus]);

	const buildPromptHref = (promptId: number) => {
		const basePath = orgId && projectId ? `/${orgId}/${projectId}` : "";
		return `${basePath}/prompt/${promptId}/playground`;
	};

	const handleDelete = async () => {
		try {
			setIsDeletingProvider(true);
			await onDelete();
			setDeleteProviderDialogOpen(false);
		} catch (_error) {
			// Error is handled by the hook
		} finally {
			setIsDeletingProvider(false);
		}
	};

	if (isLoading) {
		return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
	}

	return (
		<>
			{!provider ? (
				<div className="rounded-md p-10 text-center space-y-4">
					<p className="text-sm font-medium">You have not added a custom provider yet.</p>
					<p className="text-sm text-muted-foreground">
						Connect an OpenAI-compatible endpoint to sync and configure models.
					</p>
					<div className="flex items-center justify-center gap-3">
						<Button size="default" onClick={() => setOpenProviderDialog(true)}>
							<PlusCircle className="mr-2 h-4 w-4" /> Add Provider
						</Button>
						<a
							href="https://docs.genum.ai/llm-providers"
							target="_blank"
							rel="noreferrer"
							className="text-sm text-primary hover:underline"
						>
							Learn more
						</a>
					</div>
				</div>
			) : (
				<div className="space-y-4">
					<div className="space-y-3">
						<div className="flex items-start justify-between gap-4">
							<div />
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={onSync}
									disabled={isSyncing}
								>
									{isSyncing ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<RefreshCw className="h-4 w-4" />
									)}
									<span className="ml-1">Sync Models</span>
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setOpenProviderDialog(true)}
								>
									<Edit className="h-4 w-4" />
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setDeleteProviderDialogOpen(true)}
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
						</div>

						<div className="rounded-md border p-4">
							<div className="flex items-center gap-3">
								<Server className="h-5 w-5 text-muted-foreground" />
								<div>
									<p className="font-medium">
										{provider.name || "Custom Provider"}
									</p>
									<p className="text-sm text-muted-foreground">
										{provider.baseUrl}
									</p>
								</div>
								<Badge variant="outline" className="ml-2">
									{provider._count?.languageModels ?? 0} models
								</Badge>
							</div>
						</div>

						<div className="space-y-2">
							<ProviderModelsTable providerId={provider.id} />
						</div>
					</div>
				</div>
			)}

			<CustomModelDialog
				open={openProviderDialog}
				onOpenChange={setOpenProviderDialog}
				customProvider={provider}
				onSaved={onProviderSaved}
			/>

			<DeleteProviderDialog
				open={deleteProviderDialogOpen}
				onOpenChange={setDeleteProviderDialogOpen}
				onConfirm={handleDelete}
				deleteStatus={deleteStatus}
				deleteStatusError={deleteStatusError}
				isCheckingDeleteStatus={isCheckingDeleteStatus}
				isDeletingProvider={isDeletingProvider}
				buildPromptHref={buildPromptHref}
			/>
		</>
	);
}
