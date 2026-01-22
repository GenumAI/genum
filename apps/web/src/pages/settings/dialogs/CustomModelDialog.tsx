import * as React from "react";
import { CheckCircle2, Eye, EyeOff, Loader2, XCircle } from "lucide-react";

import { useToast } from "@/hooks/useToast";
import { organizationApi } from "@/api/organization";
import type { CustomProvider, ProviderModel } from "@/api/organization";
import { isValidBaseUrl } from "@/pages/settings/dialogs/utils/validator";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CustomModelDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	customProvider: CustomProvider | null;
	onSaved: () => void | Promise<void>;
}

export default function CustomModelDialog({
	open,
	onOpenChange,
	customProvider,
	onSaved,
}: CustomModelDialogProps) {
	const { toast } = useToast();

	const [providerBaseUrl, setProviderBaseUrl] = React.useState("");
	const [providerApiKey, setProviderApiKey] = React.useState("");
	const [showProviderApiKey, setShowProviderApiKey] = React.useState(false);
	const [isTestingConnection, setIsTestingConnection] = React.useState(false);
	const [connectionTestResult, setConnectionTestResult] = React.useState<{
		success: boolean;
		models?: ProviderModel[];
		error?: string;
	} | null>(null);
	const [isSavingProvider, setIsSavingProvider] = React.useState(false);
	const [initialBaseUrl, setInitialBaseUrl] = React.useState("");
	const [hasInvalidBaseUrl, setHasInvalidBaseUrl] = React.useState(false);

	React.useEffect(() => {
		if (!open) return;
		const baseUrl = customProvider?.baseUrl ?? "";
		setProviderBaseUrl(baseUrl);
		setInitialBaseUrl(baseUrl);
		setHasInvalidBaseUrl(false);
		setProviderApiKey("");
		setShowProviderApiKey(false);
		setConnectionTestResult(null);
	}, [open, customProvider]);

	const trimmedBaseUrl = providerBaseUrl.trim();
	const isUrlChanged = trimmedBaseUrl !== initialBaseUrl;
	React.useEffect(() => {
		if (!hasInvalidBaseUrl) return;
		if (!trimmedBaseUrl) return;
		if (isValidBaseUrl(trimmedBaseUrl)) {
			setHasInvalidBaseUrl(false);
		}
	}, [hasInvalidBaseUrl, trimmedBaseUrl]);

	const testConnection = async () => {
		if (!providerBaseUrl.trim()) return;

		try {
			setIsTestingConnection(true);
			setConnectionTestResult(null);

			const result = await organizationApi.testProviderConnection({
				apiKey: providerApiKey.trim(),
				baseUrl: providerBaseUrl.trim(),
			});

			setConnectionTestResult(result);
		} catch (e) {
			console.error(e);
			setConnectionTestResult({
				success: false,
				error: e instanceof Error ? e.message : "Connection failed",
			});
		} finally {
			setIsTestingConnection(false);
		}
	};

	const handleSaveProvider = async () => {
		if (!trimmedBaseUrl || isSavingProvider) return;
		if (!isValidBaseUrl(trimmedBaseUrl)) {
			setHasInvalidBaseUrl(true);
			toast({
				title: "Error",
				description: "Invalid base URL format",
				variant: "destructive",
			});
			return;
		}

		try {
			setIsSavingProvider(true);

			await organizationApi.upsertCustomProvider({
				vendor: "CUSTOM_OPENAI_COMPATIBLE",
				baseUrl: trimmedBaseUrl,
				key: providerApiKey.trim(),
			});

			toast({ title: "Success", description: "Provider saved" });

			onOpenChange(false);
			setProviderBaseUrl("");
			setProviderApiKey("");
			setShowProviderApiKey(false);
			setConnectionTestResult(null);

			await onSaved();
		} catch (e) {
			console.error(e);
			toast({
				title: "Error",
				description: e instanceof Error ? e.message : "Cannot save provider",
				variant: "destructive",
			});
		} finally {
			setIsSavingProvider(false);
		}
	};

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) {
			setConnectionTestResult(null);
		}
		onOpenChange(nextOpen);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>
						{customProvider ? "Edit" : "Configure"} Custom Provider
					</DialogTitle>
					<DialogDescription>
						Connect to an OpenAI-compatible API endpoint
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					<div className="space-y-1">
						<Label>Base URL</Label>
						<Input
							value={providerBaseUrl}
							onChange={(e) => setProviderBaseUrl(e.target.value)}
							placeholder="http://localhost:11434/v1"
						/>
						<p className="text-xs text-muted-foreground">
							Examples: http://localhost:11434/v1, http://localhost:1234/v1
						</p>
					</div>

					<div className="space-y-1">
						<Label>
							API Key{" "}
							<span className="text-muted-foreground font-normal">
								(optional)
							</span>
						</Label>
						<div className="relative">
							<Input
								type={showProviderApiKey ? "text" : "password"}
								value={providerApiKey}
								onChange={(e) => setProviderApiKey(e.target.value)}
								className="pr-10"
								placeholder={
									customProvider
										? "Leave empty to keep existing key"
										: "API key for authentication"
								}
							/>
							<button
								type="button"
								className="absolute right-2 top-2 text-zinc-500 [&_svg]:size-5"
								onClick={() => setShowProviderApiKey((s) => !s)}
							>
								{showProviderApiKey ? (
									<EyeOff className="h-4 w-4" />
								) : (
									<Eye className="h-4 w-4" />
								)}
							</button>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							onClick={testConnection}
							disabled={!providerBaseUrl.trim() || isTestingConnection}
						>
							{isTestingConnection ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Testing...
								</>
							) : (
								"Test Connection"
							)}
						</Button>

						{connectionTestResult && (
							<div className="flex items-center gap-2">
								{connectionTestResult.success ? (
									<>
										<CheckCircle2 className="h-4 w-4 text-green-500" />
										<span className="text-sm text-green-600">
											Connected ({connectionTestResult.models?.length} models)
										</span>
									</>
								) : (
									<>
										<XCircle className="h-4 w-4 text-red-500" />
										<span className="text-sm text-red-600">
											{connectionTestResult.error || "Failed"}
										</span>
									</>
								)}
							</div>
						)}
					</div>

					{connectionTestResult?.success &&
						connectionTestResult.models &&
						connectionTestResult.models.length > 0 && (
							<div className="border rounded-md p-3 bg-muted/30">
								<p className="text-sm font-medium mb-2">Available Models:</p>
								<div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
									{connectionTestResult.models.map((model) => (
										<Badge
											key={model.id}
											variant="secondary"
											className="text-xs"
										>
											{model.id}
										</Badge>
									))}
								</div>
							</div>
						)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={handleSaveProvider}
						disabled={
							!trimmedBaseUrl || isSavingProvider || !isUrlChanged || hasInvalidBaseUrl
						}
					>
						{isSavingProvider ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
