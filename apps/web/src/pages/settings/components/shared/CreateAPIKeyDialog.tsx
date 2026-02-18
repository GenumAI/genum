import { useState, useEffect } from "react";
import { CheckIcon, CopyIcon, EyeClosedIcon, EyeIcon, PlusCircleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/useToast";
import type { CreateAPIKeyDialogProps } from "../../utils/types";

export function CreateAPIKeyDialog({
	open,
	onOpenChange,
	onCreate,
	isCreating,
	newKeyResponse,
	onDone,
}: CreateAPIKeyDialogProps) {
	const { toast } = useToast();
	const [keyName, setKeyName] = useState("");
	const [showKey, setShowKey] = useState(false);
	const [copied, setCopied] = useState(false);

	const handleCreate = async () => {
		const success = await onCreate(keyName);
		if (success) {
			setKeyName("");
		}
	};

	const handleCopy = async () => {
		if (!newKeyResponse?.key) return;
		try {
			await navigator.clipboard.writeText(newKeyResponse.key);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
			toast({
				title: "Copied",
				description: "API key copied to clipboard",
				duration: 3000,
			});
		} catch (error) {
			console.error("Failed to copy:", error);
		}
	};

	const handleDone = () => {
		setShowKey(false);
		onDone();
		onOpenChange(false);
	};

	useEffect(() => {
		if (!open) {
			setKeyName("");
			setShowKey(false);
		}
	}, [open]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>
				<Button size="default" className="[&_svg]:size-6">
					<PlusCircleIcon />
					Create API Key
				</Button>
			</DialogTrigger>

			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Create API Key</DialogTitle>
				</DialogHeader>
				{newKeyResponse ? (
					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="apiKey">API Key</Label>

							<div className="flex gap-2">
								<div className="relative flex-1">
									<Input
										id="apiKey"
										type={showKey ? "text" : "password"}
										value={newKeyResponse.key}
										readOnly
										className="pr-10 text-[15px] font-mono h-[40px]"
										onClick={(e) => (e.target as HTMLInputElement).select()}
									/>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										onClick={() => setShowKey((v) => !v)}
										className="absolute inset-y-0 right-[3px] top-[4px] h-8 w-8 flex items-center [&_svg]:size-5"
									>
										{showKey ? (
											<EyeClosedIcon className="h-4 w-4" size={16} />
										) : (
											<EyeIcon className="h-4 w-4" size={16} />
										)}
									</Button>
								</div>
								<Button
									type="button"
									variant="outline"
									size="icon"
									onClick={handleCopy}
									className="shrink-0 h-[40px] w-10"
								>
									{copied ? (
										<CheckIcon className="h-4 w-4 text-green-600" size={16} />
									) : (
										<CopyIcon className="h-4 w-4" size={16} />
									)}
								</Button>
							</div>
						</div>

						<p className="text-sm text-muted-foreground">
							Your new API key has been created.{" "}
							<span className="font-medium text-zinc-800">Please copy it now.</span>{" "}
							You won't be able to see it again!
						</p>

						<DialogFooter>
							<Button onClick={handleDone}>Done</Button>
						</DialogFooter>
					</div>
				) : (
					<div className="grid gap-4">
						<div className="space-y-2">
							<Label htmlFor="apiKeyName">Name</Label>
							<Input
								id="apiKeyName"
								placeholder="Enter API Key name"
								value={keyName}
								onChange={(e) => setKeyName(e.target.value)}
							/>
						</div>

						<DialogFooter>
							<Button variant="outline" onClick={() => onOpenChange(false)}>
								Cancel
							</Button>
							<Button onClick={handleCreate} disabled={!keyName.trim() || isCreating}>
								{isCreating ? "Creating..." : "Save"}
							</Button>
						</DialogFooter>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
