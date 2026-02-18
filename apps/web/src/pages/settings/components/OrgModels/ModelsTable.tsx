import { useState } from "react";
import {
	Table,
	TableHeader,
	TableHead,
	TableBody,
	TableRow,
	TableCell,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { LanguageModel } from "../../hooks/useOrgModels";

interface ModelsTableProps {
	models: LanguageModel[];
	isLoading: boolean;
	isToggling: boolean;
	onToggle: (modelId: number, enabled: boolean) => void;
}

const VENDOR_NAMES: Record<string, string> = {
	OPENAI: "OpenAI",
	ANTHROPIC: "Anthropic",
	GOOGLE: "Google",
	CUSTOM_OPENAI_COMPATIBLE: "Custom Provider",
};

const VENDOR_ORDER: Record<string, number> = {
	OPENAI: 1,
	ANTHROPIC: 2,
	GOOGLE: 3,
	CUSTOM_OPENAI_COMPATIBLE: 4,
};

export function ModelsTable({ models, isLoading, isToggling, onToggle }: ModelsTableProps) {
	const [search, setSearch] = useState("");

	if (isLoading) {
		return <div className="p-6 text-sm text-muted-foreground">Loading models...</div>;
	}

	if (models.length === 0) {
		return <div className="p-6 text-sm text-muted-foreground">No models available</div>;
	}

	// Filter models by search query
	const filteredModels = models.filter(
		(model) =>
			model.name.toLowerCase().includes(search.toLowerCase()) ||
			model.displayName?.toLowerCase().includes(search.toLowerCase()) ||
			VENDOR_NAMES[model.vendor]?.toLowerCase().includes(search.toLowerCase()),
	);

	// Group models by vendor
	const groupedModels = filteredModels.reduce(
		(acc, model) => {
			if (!acc[model.vendor]) {
				acc[model.vendor] = [];
			}
			acc[model.vendor].push(model);
			return acc;
		},
		{} as Record<string, LanguageModel[]>,
	);

	// Sort vendors by predefined order
	const sortedVendors = Object.keys(groupedModels).sort(
		(a, b) => (VENDOR_ORDER[a] || 99) - (VENDOR_ORDER[b] || 99),
	);

	const formatPrice = (price: number) => {
		if (price === 0) return "-";
		return `$${price.toFixed(2)}`;
	};

	const formatTokens = (tokens: number) => {
		if (tokens === 0) return "-";
		if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
		if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
		return tokens.toString();
	};

	return (
		<div className="space-y-4">
			{/* Search */}
			<div className="relative max-w-sm">
				<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					placeholder="Search models..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="pl-9"
				/>
			</div>

			{/* Table */}
			{sortedVendors.length === 0 ? (
				<div className="p-6 text-sm text-muted-foreground">
					No models found matching "{search}"
				</div>
			) : (
				<div className="relative overflow-x-auto rounded-md border">
					<Table>
						<TableHeader className="bg-[#F4F4F5] dark:bg-[#262626]">
							<TableRow>
								<TableHead className="text-left p-4 w-[300px]">Model</TableHead>
								<TableHead className="text-right p-4 w-[120px]">
									Prompt Price
									<div className="text-xs font-normal text-muted-foreground">/1M tokens</div>
								</TableHead>
								<TableHead className="text-right p-4 w-[120px]">
									Completion Price
									<div className="text-xs font-normal text-muted-foreground">/1M tokens</div>
								</TableHead>
								<TableHead className="text-right p-4 w-[120px]">Context</TableHead>
								<TableHead className="text-center p-4 w-[100px]">Enabled</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{sortedVendors.map((vendor) => (
								<>
									{/* Vendor Header Row */}
									<TableRow key={`vendor-${vendor}`} className="bg-muted/50">
										<TableCell colSpan={5} className="font-semibold py-2 px-4">
											{VENDOR_NAMES[vendor] || vendor}
										</TableCell>
									</TableRow>
									{/* Model Rows */}
									{groupedModels[vendor].map((model) => (
										<TableRow key={model.id} className="hover:bg-muted/50">
											<TableCell className="align-middle p-4">
												<div>
													<div className="font-medium">
														{model.displayName || model.name}
													</div>
													{model.displayName && (
														<div className="text-xs text-muted-foreground">
															{model.name}
														</div>
													)}
												</div>
											</TableCell>
											<TableCell className="align-middle text-right p-4">
												{formatPrice(model.promptPrice)}
											</TableCell>
											<TableCell className="align-middle text-right p-4">
												{formatPrice(model.completionPrice)}
											</TableCell>
											<TableCell className="align-middle text-right p-4">
												{formatTokens(model.contextTokensMax)}
											</TableCell>
											<TableCell className="align-middle text-center p-4">
												<div className="flex justify-center">
													<Switch
														checked={model.enabled !== false}
														onCheckedChange={(checked) =>
															onToggle(model.id, checked)
														}
														disabled={isToggling}
														aria-label={`Toggle ${model.name}`}
													/>
												</div>
											</TableCell>
										</TableRow>
									))}
								</>
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
}
