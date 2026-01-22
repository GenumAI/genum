import * as React from "react";
import { Link, useParams } from "react-router-dom";
import {
	PlusCircle,
	Trash2,
	Eye,
	EyeOff,
	RefreshCw,
	Server,
	Loader2,
	Settings,
	Edit,
} from "lucide-react";

import { useToast } from "@/hooks/useToast";
import { organizationApi } from "@/api/organization";
import type {
	CustomProvider,
	CustomProviderDeleteStatus,
	LanguageModel,
} from "@/api/organization";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
	Table,
	TableHeader,
	TableHead,
	TableBody,
	TableRow,
	TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogTrigger,
	DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CustomModelDialog from "@/pages/settings/dialogs/CustomModelDialog";
import ModelConfigDialog from "@/pages/settings/dialogs/ModelConfigDialog";

type Vendor = "OPENAI" | "GOOGLE" | "ANTHROPIC";
enum SettingsTab {
	PROVIDERS = "providers",
	CUSTOM = "custom",
}

interface AIKey {
	id: number;
	vendor: string;
	createdAt: string;
	publicKey: string;
}

export default function OrgAIKeys() {
	const { toast } = useToast();
	const { orgId, projectId } = useParams();

	// Standard AI Keys state
	const [keys, setKeys] = React.useState<AIKey[]>([]);
	const [isLoadingKeys, setIsLoadingKeys] = React.useState(false);

	// Quota state
	const [quota, setQuota] = React.useState<number | null>(null);
	const [isLoadingQuota, setIsLoadingQuota] = React.useState(false);

	// Add standard key dialog
	const [openAdd, setOpenAdd] = React.useState(false);
	const [vendor, setVendor] = React.useState<Vendor>("OPENAI");
	const [secret, setSecret] = React.useState("");
	const [showSecret, setShowSecret] = React.useState(false);
	const [isCreating, setIsCreating] = React.useState(false);

	// Delete dialog
	const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
	const [keyToDelete, setKeyToDelete] = React.useState<AIKey | null>(null);
	const [deletingKeyId, setDeletingKeyId] = React.useState<number | null>(null);

	// Custom Provider state (single)
	const [customProvider, setCustomProvider] = React.useState<CustomProvider | null>(null);
	const [isLoadingProvider, setIsLoadingProvider] = React.useState(false);

	// Provider dialog
	const [openProviderDialog, setOpenProviderDialog] = React.useState(false);

	// Delete provider dialog
	const [deleteProviderDialogOpen, setDeleteProviderDialogOpen] = React.useState(false);
	const [isDeletingProvider, setIsDeletingProvider] = React.useState(false);
	const [deleteStatus, setDeleteStatus] = React.useState<CustomProviderDeleteStatus | null>(
		null,
	);
	const [deleteStatusError, setDeleteStatusError] = React.useState<string | null>(null);
	const [isCheckingDeleteStatus, setIsCheckingDeleteStatus] = React.useState(false);

	// Sync state
	const [isSyncing, setIsSyncing] = React.useState(false);

	const [activeTab, setActiveTab] = React.useState<string>(SettingsTab.PROVIDERS);

	// ==================== Fetch Functions ====================

	const fetchQuota = React.useCallback(async () => {
		try {
			setIsLoadingQuota(true);
			const data = await organizationApi.getQuota();
			setQuota(data?.quota?.balance ?? null);
		} catch (e) {
			console.error(e);
			toast({ title: "Error", description: "Failed to load quota", variant: "destructive" });
			setQuota(null);
		} finally {
			setIsLoadingQuota(false);
		}
	}, [toast]);

	const fetchKeys = React.useCallback(async () => {
		try {
			setIsLoadingKeys(true);
			const data = await organizationApi.getAIKeys();
			// Filter out custom provider from standard keys
			setKeys(
				(data?.keys ?? []).filter((k) => k.vendor !== "CUSTOM_OPENAI_COMPATIBLE"),
			);
		} catch (e) {
			console.error(e);
			toast({ title: "Error", description: "Failed to load keys", variant: "destructive" });
			setKeys([]);
		} finally {
			setIsLoadingKeys(false);
		}
	}, [toast]);

	const fetchCustomProvider = React.useCallback(async () => {
		try {
			setIsLoadingProvider(true);
			const data = await organizationApi.getCustomProvider();
			setCustomProvider(data?.provider ?? null);
		} catch (e) {
			console.error(e);
			setCustomProvider(null);
		} finally {
			setIsLoadingProvider(false);
		}
	}, []);

	const fetchDeleteStatus = React.useCallback(async () => {
		try {
			setIsCheckingDeleteStatus(true);
			setDeleteStatusError(null);
			const status = await organizationApi.getCustomProviderDeleteStatus();
			setDeleteStatus(status);
		} catch (e) {
			console.error(e);
			setDeleteStatus(null);
			setDeleteStatusError("Failed to check if the provider can be deleted.");
		} finally {
			setIsCheckingDeleteStatus(false);
		}
	}, []);

	React.useEffect(() => {
		fetchKeys();
		fetchQuota();
		fetchCustomProvider();
	}, [fetchKeys, fetchQuota, fetchCustomProvider]);

	React.useEffect(() => {
		if (!deleteProviderDialogOpen) {
			setDeleteStatus(null);
			setDeleteStatusError(null);
			setIsCheckingDeleteStatus(false);
			return;
		}

		fetchDeleteStatus();
	}, [deleteProviderDialogOpen, fetchDeleteStatus]);

	// ==================== Standard Key Handlers ====================

	const handleAdd = async () => {
		const trimmed = secret.trim();
		if (!trimmed || isCreating) return;

		try {
			setIsCreating(true);
			await organizationApi.createAIKey({ key: trimmed, vendor });
			toast({ title: "Success", description: "Key added" });

			setOpenAdd(false);
			setSecret("");
			setShowSecret(false);

			await fetchKeys();
		} catch (e) {
			console.error(e);
			toast({ title: "Error", description: "Cannot add key", variant: "destructive" });
		} finally {
			setIsCreating(false);
		}
	};

	const openDeleteDialog = (key: AIKey) => {
		setKeyToDelete(key);
		setDeleteDialogOpen(true);
	};

	const deleteKey = async () => {
		if (!keyToDelete || deletingKeyId !== null) return;

		try {
			setDeletingKeyId(keyToDelete.id);
			await organizationApi.deleteAIKey(keyToDelete.id);

			toast({ title: "Deleted", description: "Key removed" });

			setDeleteDialogOpen(false);
			setKeyToDelete(null);

			await fetchKeys();
		} catch (e) {
			console.error(e);
			toast({ title: "Error", description: "Cannot delete key", variant: "destructive" });
		} finally {
			setDeletingKeyId(null);
		}
	};

	// ==================== Custom Provider Handlers ====================

	const handleDeleteProvider = async () => {
		if (isDeletingProvider || isCheckingDeleteStatus) return;
		if (deleteStatusError) {
			toast({
				title: "Error",
				description: deleteStatusError,
				variant: "destructive",
			});
			return;
		}
		if (deleteStatus && !deleteStatus.canDelete) {
			toast({
				title: "Cannot delete provider",
				description: "This provider is still in use by prompts or productive commits.",
				variant: "destructive",
			});
			return;
		}

		try {
			setIsDeletingProvider(true);
			await organizationApi.deleteCustomProvider();

			toast({ title: "Deleted", description: "Custom provider removed" });

			setDeleteProviderDialogOpen(false);
			setCustomProvider(null);
		} catch (e) {
			console.error(e);
			toast({
				title: "Error",
				description: "Cannot delete provider",
				variant: "destructive",
			});
			await fetchDeleteStatus();
		} finally {
			setIsDeletingProvider(false);
		}
	};

	const syncProviderModels = async () => {
		if (isSyncing) return;

		try {
			setIsSyncing(true);

			const result = await organizationApi.syncProviderModels();

			toast({
				title: "Synced",
				description: `${result.created} new, ${result.existing} existing${result.removed > 0 ? `, ${result.removed} removed` : ""}`,
			});

			await fetchCustomProvider();
		} catch (e) {
			console.error(e);
			toast({
				title: "Error",
				description: e instanceof Error ? e.message : "Failed to sync models",
				variant: "destructive",
			});
		} finally {
			setIsSyncing(false);
		}
	};

	const formatBalance = (balance: number | null) => {
		if (balance === null) return "--";
		return `$${balance.toFixed(2)}`;
	};

	const buildPromptHref = React.useCallback(
		(promptId: number) => {
			const basePath = orgId && projectId ? `/${orgId}/${projectId}` : "";
			return `${basePath}/prompt/${promptId}/playground`;
		},
		[orgId, projectId],
	);

	const isDeleteBlocked = Boolean(deleteStatus && !deleteStatus.canDelete);
	const isDeleteDisabled =
		isDeletingProvider || isCheckingDeleteStatus || Boolean(deleteStatusError) || isDeleteBlocked;

	return (
		<Card className="rounded-md shadow-none">
			{/* Quota Card */}
			<Card className="w-auto rounded-md shadow-[0px_1px_2px_0px_#0000000D] mx-6 mt-6 p-6">
				<CardContent className="p-0">
					<p className="text-[14px] leading-[20px] font-medium mb-2">Balance:</p>
					<p className="text-[24px] leading-[32px] font-bold">
						{isLoadingQuota ? "Loading..." : formatBalance(quota)}
					</p>
					<p className="text-[12px] leading-[16px] text-[#71717A]">
						While your organization has quota, it will be used for AI requests. Once
						the quota is exhausted, user-provided API keys will be used instead.
					</p>
				</CardContent>
			</Card>

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
						<div className="flex items-center justify-between mb-4">
							<p className="text-sm text-muted-foreground">
								Add API keys for hosted providers.
							</p>
							<Dialog open={openAdd} onOpenChange={setOpenAdd}>
								<DialogTrigger asChild>
									<Button size="default" className="w-[144px]">
										<PlusCircle className="mr-2 h-4 w-4" /> Add Key
									</Button>
								</DialogTrigger>

								<DialogContent className="sm:max-w-[420px]">
									<DialogHeader>
										<DialogTitle>Add LLM Provider Key</DialogTitle>
									</DialogHeader>

									<div className="space-y-4 py-2">
										<div className="space-y-1">
											<Label>Vendor</Label>
											<Select
												value={vendor}
												onValueChange={(v) => setVendor(v as Vendor)}
											>
												<SelectTrigger className="text-[14px]">
													<SelectValue placeholder="Select vendor" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="OPENAI">OpenAI</SelectItem>
													<SelectItem value="GOOGLE">Google</SelectItem>
													<SelectItem value="ANTHROPIC">Anthropic</SelectItem>
												</SelectContent>
											</Select>
										</div>

										<div className="space-y-1">
											<Label>API Key</Label>
											<div className="relative">
												<Input
													type={showSecret ? "text" : "password"}
													value={secret}
													onChange={(e) => setSecret(e.target.value)}
													className="pr-10"
													placeholder="Enter API key"
												/>
												<button
													type="button"
													className="absolute right-2 top-2 text-zinc-500 [&_svg]:size-5"
													onClick={() => setShowSecret((s) => !s)}
												>
													{showSecret ? (
														<EyeOff className="h-4 w-4" />
													) : (
														<Eye className="h-4 w-4" />
													)}
												</button>
											</div>
										</div>
									</div>

									<DialogFooter>
										<Button onClick={handleAdd} disabled={!secret.trim() || isCreating}>
											{isCreating ? "Adding..." : "OK"}
										</Button>
									</DialogFooter>
								</DialogContent>
							</Dialog>
						</div>

						{isLoadingKeys ? (
							<div className="p-6 text-sm text-muted-foreground">Loading…</div>
						) : keys.length === 0 ? (
							<div className="p-6 text-sm text-muted-foreground">No keys</div>
						) : (
							<div className="relative overflow-x-auto rounded-md border-0">
								<Table className="rounded-md overflow-hidden">
									<TableHeader className="bg-[#F4F4F5] dark:bg-[#262626] dark:text-[#fff] h-12 font-medium text-muted-foreground">
										<TableRow>
											<TableHead className="text-left p-4">Vendor</TableHead>
											<TableHead className="text-left p-4">API Key</TableHead>
											<TableHead className="text-left p-4">Created At</TableHead>
											<TableHead className="w-[100px] text-center p-4">
												Actions
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{keys.map((k) => (
											<TableRow key={k.id}>
												<TableCell>{k.vendor}</TableCell>
												<TableCell>{k.publicKey}</TableCell>
												<TableCell>{new Date(k.createdAt).toLocaleString()}</TableCell>
												<TableCell className="text-center">
													<Button
														variant="ghost"
														className="size-8"
														onClick={() => openDeleteDialog(k)}
														disabled={deletingKeyId === k.id}
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						)}
					</TabsContent>

					<TabsContent value={SettingsTab.CUSTOM} className="mt-4">
						{isLoadingProvider ? (
							<div className="p-6 text-sm text-muted-foreground">Loading…</div>
						) : (
							<div className="space-y-4">
								{!customProvider ? (
									<div className="rounded-md p-10 text-center space-y-4">
										<p className="text-sm font-medium">
											You have not added a custom provider yet.
										</p>
										<p className="text-sm text-muted-foreground">
											Connect an OpenAI-compatible endpoint to sync and configure models.
										</p>
										<div className="flex items-center justify-center gap-3">
											<Button
												size="default"
												onClick={() => setOpenProviderDialog(true)}
											>
												<PlusCircle className="mr-2 h-4 w-4" /> Add Provider
											</Button>
											<a
												href="https://docs.genum.ai"
												target="_blank"
												rel="noreferrer"
												className="text-sm text-primary hover:underline"
											>
												Learn more
											</a>
										</div>
									</div>
								) : (
									<div className="space-y-3">
										<div className="flex items-start justify-between gap-4">
											<div />
											<div className="flex items-center gap-2">
												<Button
													variant="outline"
													size="sm"
													onClick={syncProviderModels}
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
														{customProvider.name || "Custom Provider"}
													</p>
													<p className="text-sm text-muted-foreground">
														{customProvider.baseUrl}
													</p>
												</div>
												<Badge variant="outline" className="ml-2">
													{customProvider._count?.languageModels ?? 0} models
												</Badge>
											</div>
										</div>

										<div className="space-y-2">
											<ProviderModelsSection providerId={customProvider.id} />
										</div>
									</div>
								)}
							</div>
						)}
					</TabsContent>
				</Tabs>
			</CardContent>

			{/* Delete Standard Key Dialog */}
			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>Delete API Key</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete the{" "}
							<strong>{keyToDelete?.vendor}</strong> API key{" "}
							<strong>"{keyToDelete?.publicKey}"</strong>? This action cannot be
							undone.
						</DialogDescription>
					</DialogHeader>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setDeleteDialogOpen(false);
								setKeyToDelete(null);
							}}
						>
							Cancel
						</Button>
						<Button
							onClick={deleteKey}
							disabled={!keyToDelete || deletingKeyId !== null}
							className="bg-red-600 hover:bg-red-700 text-white"
						>
							{deletingKeyId === keyToDelete?.id ? "Deleting..." : "Delete Key"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<CustomModelDialog
				open={openProviderDialog}
				onOpenChange={setOpenProviderDialog}
				customProvider={customProvider}
				onSaved={fetchCustomProvider}
			/>

			{/* Delete Provider Dialog */}
			<Dialog open={deleteProviderDialogOpen} onOpenChange={setDeleteProviderDialogOpen}>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>Delete Custom Provider</DialogTitle>
						<DialogDescription>
							{isCheckingDeleteStatus
								? "Checking if this provider can be deleted..."
								: isDeleteBlocked
								  ? "Provider is in use. See details below."
								  : "Deleting the provider will have the following effects:"}
						</DialogDescription>
					</DialogHeader>

					{deleteStatusError && (
						<p className="text-sm text-red-600">{deleteStatusError}</p>
					)}

					{isCheckingDeleteStatus && (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Loader2 className="h-4 w-4 animate-spin" />
							<span>Checking usage...</span>
						</div>
					)}

					{isDeleteBlocked && deleteStatus && (
						<div className="space-y-3 text-sm">
							<p className="text-muted-foreground">
								Deletion is blocked by the prompts below.
							</p>
							{deleteStatus.promptUsagePrompts.length > 0 && (
								<div className="space-y-2">
									<p className="text-muted-foreground font-medium">
										Prompts using provider models
									</p>
									<ul className="space-y-1">
										{deleteStatus.promptUsagePrompts.map((prompt) => (
											<li
												key={`prompt-usage-${prompt.id}`}
												className="flex items-center gap-2"
											>
												<Link
													to={buildPromptHref(prompt.id)}
													target="_blank"
													rel="noreferrer"
													className="text-primary hover:underline"
												>
													{prompt.name}
												</Link>
												<span className="text-muted-foreground/70">({prompt.id})</span>
											</li>
										))}
									</ul>
								</div>
							)}
							{deleteStatus.productiveCommitUsagePrompts.length > 0 && (
								<div className="space-y-2">
									<p className="text-muted-foreground font-medium">
										Prompts with productive commits using custom models
									</p>
									<ul className="space-y-1">
										{deleteStatus.productiveCommitUsagePrompts.map((prompt) => (
											<li
												key={`productive-usage-${prompt.id}`}
												className="flex items-center gap-2"
											>
												<Link
													to={buildPromptHref(prompt.id)}
													target="_blank"
													rel="noreferrer"
													className="text-primary hover:underline"
												>
													{prompt.name}
												</Link>
												<span className="text-muted-foreground/70">({prompt.id})</span>
											</li>
										))}
									</ul>
								</div>
							)}
						</div>
					)}

					{!isDeleteBlocked && (
						<p className="text-sm text-muted-foreground">
							This action is irreversible. All synced models will be deleted.
						</p>
					)}

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setDeleteProviderDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={handleDeleteProvider}
							disabled={isDeleteDisabled}
							className="bg-red-600 hover:bg-red-700 text-white"
						>
							{isDeletingProvider ? "Deleting..." : "Delete Provider"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}

// ==================== Provider Models Section Component ====================

function ProviderModelsSection({ providerId: _providerId }: { providerId: number }) {
	const { toast } = useToast();
	const [models, setModels] = React.useState<LanguageModel[]>([]);
	const [isLoading, setIsLoading] = React.useState(true);

	// Model config dialog state
	const [configDialogOpen, setConfigDialogOpen] = React.useState(false);
	const [selectedModel, setSelectedModel] = React.useState<LanguageModel | null>(null);

	const fetchModels = React.useCallback(async () => {
		try {
			setIsLoading(true);
			const data = await organizationApi.getProviderModels();
			setModels(data.models);
		} catch (e) {
			console.error(e);
			toast({
				title: "Error",
				description: "Failed to load models",
				variant: "destructive",
			});
		} finally {
			setIsLoading(false);
		}
	}, [toast]);

	React.useEffect(() => {
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
