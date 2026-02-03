import { useState } from "react";
import { Eye, EyeOff, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogTrigger,
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
import { useToast } from "@/hooks/useToast";
import type { Vendor, AddAIKeyDialogProps } from "../../utils/types";

export function AddAIKeyDialog({ onAdd }: AddAIKeyDialogProps) {
	const { toast } = useToast();
	const [open, setOpen] = useState(false);
	const [vendor, setVendor] = useState<Vendor>("OPENAI");
	const [secret, setSecret] = useState("");
	const [showSecret, setShowSecret] = useState(false);
	const [isCreating, setIsCreating] = useState(false);

	const handleAdd = async () => {
		const trimmed = secret.trim();
		if (!trimmed || isCreating) return;

		try {
			setIsCreating(true);
			await onAdd(trimmed, vendor);
			setOpen(false);
			setSecret("");
			setShowSecret(false);
		} catch (error) {
			console.error("Error adding API key:", error);
			toast({
				title: "Error",
				description: "Failed to add API key. Please try again.",
				variant: "destructive",
				duration: 3000,
			});
		} finally {
			setIsCreating(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
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
						<Select value={vendor} onValueChange={(v) => setVendor(v as Vendor)}>
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
								{showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
	);
}
