import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
	ChevronLeft,
	ChevronDown,
	SquareTerminal,
	BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate, useParams } from "react-router-dom";
import { useMemo, useState, useEffect, useCallback } from "react";
import { promptApi } from "@/api/prompt";
import { JSONTree } from "react-json-tree";
import AuditResultsModal from "@/components/dialogs/AuditResultsDialog";
import { RollBackButton } from "./RollbackButton";

interface AuditRisk {
	type: string;
	level: "low" | "medium" | "high";
	comment: string;
	recommendation: string;
}

interface AuditData {
	rate: number;
	risks: AuditRisk[];
	summary: string;
}

/** JSONTree themes */
const jsonThemeLight = {
	scheme: "custom",
	base00: "#ffffff",
	base01: "#f5f5f5",
	base02: "#f0f0f0",
	base03: "#999999",
	base04: "#555555",
	base05: "#000000",
	base06: "#111111",
	base07: "#000000",
	base08: "#2b6cb0",
	base09: "#2b6cb0",
	base0A: "#2b6cb0",
	base0B: "#2b6cb0",
	base0C: "#2b6cb0",
	base0D: "#2b6cb0",
	base0E: "#2b6cb0",
	base0F: "#2b6cb0",
};

const jsonThemeDark = {
	scheme: "custom-dark",
	base00: "#0b0c10", 
	base01: "#111318", 
	base02: "#171a20",
	base03: "#7f8791", 
	base04: "#a6adb7",
	base05: "#e6e8eb", 
	base06: "#f2f4f7",
	base07: "#ffffff",
	base08: "#2b6cb0", 
	base09: "#2b6cb0",
	base0A: "#2b6cb0",
	base0B: "#2b6cb0",
	base0C: "#2b6cb0",
	base0D: "#2b6cb0",
	base0E: "#2b6cb0",
	base0F: "#2b6cb0",
};

export default function VersionDetails() {
	const navigate = useNavigate();
	const { id, versionId } = useParams<{ id: string; versionId: string }>();
	const [schemaViewMode, setSchemaViewMode] = useState<"tree" | "raw">("tree");
	const [toolsViewMode, setToolsViewMode] = useState<"tree" | "raw">("tree");
	const [showAuditModal, setShowAuditModal] = useState(false);

	const [data, setData] = useState<any>(null);

	const fetchData = useCallback(async () => {
		if (!id || !versionId) return;
		try {
			const versionData = await promptApi.getVersion(id, versionId);
			setData(versionData);
		} catch (error) {
			console.error("Failed to fetch version details", error);
		}
	}, [id, versionId]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const backHandler = () => {
		navigate(-1);
	};

	const handleOpenAuditModal = useCallback(() => {
		setShowAuditModal(true);
	}, []);

	const handleCloseAuditModal = useCallback(() => {
		setShowAuditModal(false);
	}, []);

	const parsedSchema = useMemo(() => {
		try {
			const jsonSchema = data?.version?.languageModelConfig?.json_schema;
			if (!jsonSchema) return null;
			if (typeof jsonSchema === "string") {
				return JSON.parse(jsonSchema);
			}
			return jsonSchema;
		} catch (e) {
			console.error("Failed to parse JSON schema:", e);
			return null;
		}
	}, [data]);

	const parsedTools = useMemo(() => {
		const tools = data?.version?.languageModelConfig?.tools;
		if (!tools || !Array.isArray(tools) || tools.length === 0) {
			return null;
		}
		return tools;
	}, [data]);

	const auditData: AuditData | null = useMemo(() => {
		return data?.version?.audit || null;
	}, [data?.version?.audit]);

	const modelConfigParams = useMemo(() => {
		if (!data?.version?.languageModelConfig) return [];

		const config = data.version.languageModelConfig;
		return Object.entries(config)
			.filter(([key, value]) => {
				if (value === undefined || value === null) return false;
				if (key === "tools" || key === "json_schema") return false;
				return true;
			})
			.map(([key, value]) => {
				let displayValue: string;
				if (Array.isArray(value)) {
					displayValue = JSON.stringify(value);
				} else if (typeof value === "object" && value !== null) {
					displayValue = JSON.stringify(value);
				} else {
					displayValue = String(value);
				}
				return [key, displayValue] as [string, string];
			});
	}, [data?.version?.languageModelConfig]);

	// choose the theme for JSONTree under the current mode
	const isDark =
		typeof document !== "undefined" && document.documentElement.classList.contains("dark");
	const activeJsonTheme = isDark ? jsonThemeDark : jsonThemeLight;

	return (
		<div className="px-8 py-10 space-y-6 max-w-[936px] min-h-screen bg-background text-foreground">
			<Button variant="outline" className="flex items-center text-sm" onClick={backHandler}>
				<ChevronLeft className="h-4 w-4" />
				<span>Back</span>
			</Button>

			{data && (
				<>
					<div className="p-6 border border-border rounded-xl flex flex-col gap-6 bg-card text-card-foreground">
						<Card className="bg-muted rounded-md border border-border shadow-sm">
							<CardContent className="p-6">
								<div className="text-base leading-5 font-medium mb-6 text-foreground">
									{data?.version?.commitMsg}
								</div>
								<div className="flex items-center space-x-2.5 text-sm text-muted-foreground">
									<span className="text-xs font-medium px-2.5 py-0 rounded-sm border border-border text-foreground">
										{data?.version?.commitHash
											? data?.version?.commitHash.substring(0, 8)
											: ""}
									</span>
									<span className="text-green-600 dark:text-green-400 text-xs font-medium px-2.5 py-0 rounded-sm border border-green-600/40 dark:border-green-400/40 bg-green-500/10">
										{data?.version?.branch?.name}
									</span>
									<span>{new Date(data?.version?.createdAt).toLocaleString()}</span>
									<span>by {data?.version?.author?.name}</span>
								</div>
							</CardContent>
						</Card>

						<RollBackButton />

						<div>
							<h3 className="text-lg font-semibold text-foreground mb-2">
								Model Configuration
							</h3>
							<Card className="bg-muted border border-border shadow-sm rounded-md">
								<CardContent className="p-6">
									<div className="inline-flex items-center mb-4">
										<span className="text-xs text-[#b66ad6] border border-[#b66ad6] font-medium px-2 py-0.5 rounded-sm mr-2 bg-[#b66ad6]/10">
											{data?.version?.languageModel?.vendor}
										</span>
										<span className="text-sm text-foreground font-medium">
											{data?.version?.languageModel?.name}
										</span>
									</div>
									<p className="text-sm text-muted-foreground mb-4">
										{data?.version?.languageModel?.description}
									</p>
									{modelConfigParams.length > 0 && (
										<div className="overflow-hidden rounded-md border border-border">
											<table className="w-full text-sm text-left rounded-lg bg-card text-card-foreground">
												<thead className="bg-muted">
													<tr className="border-b border-border">
														<th className="py-2 px-4 font-medium w-[311px] border-r border-border">
															Parameter
														</th>
														<th className="py-2 px-4 font-medium">
															Value
														</th>
													</tr>
												</thead>
												<tbody>
													{modelConfigParams.map(([param, value]) => (
														<tr
															key={param}
															className="border-b border-border [&:last-child]:border-b-0"
														>
															<td className="py-2 px-4 text-muted-foreground w-[311px] border-r border-border">
																{param}
															</td>
															<td className="py-2 px-4 text-foreground">
																{value}
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									)}
								</CardContent>
							</Card>
						</div>

						{parsedSchema && (
							<div>
								<h3 className="text-lg font-semibold text-foreground mb-3">
									JSON Schema
								</h3>

								<AccordionPrimitive.Root
									type="single"
									collapsible
									className="bg-card border border-border rounded-xl overflow-hidden"
								>
									<AccordionPrimitive.Item value="schema-item">
										<AccordionPrimitive.Header>
											<AccordionPrimitive.Trigger className="group flex items-center w-full text-left text-sm font-medium text-foreground hover:underline bg-muted p-3">
												<ChevronDown className="h-4 w-4 text-muted-foreground mr-2 transition-transform group-data-[state=open]:rotate-180" />
												<SquareTerminal className="h-4 w-4 mr-2" />
												<span>output_schema</span>
											</AccordionPrimitive.Trigger>
										</AccordionPrimitive.Header>
										<AccordionPrimitive.Content className="bg-card">
											<div className="mb-4 inline-flex overflow-hidden px-4 pt-4">
												<button type="button"
													onClick={() => setSchemaViewMode("tree")}
													className={cn(
														"px-4 py-1.5 text-sm font-medium focus:outline-none rounded-l-md border",
														schemaViewMode === "tree"
															? "bg-card text-foreground border-[#2b6cb0] text-[#2b6cb0]"
															: "bg-card text-muted-foreground border-border hover:bg-muted",
													)}
												>
													Tree
												</button>
												<button type="button"
													onClick={() => setSchemaViewMode("raw")}
													className={cn(
														"px-4 py-1.5 text-sm font-medium focus:outline-none rounded-r-md border",
														schemaViewMode === "raw"
															? "bg-card text-foreground border-[#2b6cb0] text-[#2b6cb0]"
															: "bg-card text-muted-foreground border-border hover:bg-muted",
													)}
												>
													Raw
												</button>
											</div>

											{schemaViewMode === "tree" ? (
												<div className="p-4 pt-0 rounded text-xs text-foreground overflow-auto">
													<JSONTree
														data={parsedSchema}
														theme={activeJsonTheme}
														invertTheme={false}
													/>
												</div>
											) : (
												<pre className="p-4 pt-0 rounded text-xs text-foreground overflow-auto">
													{JSON.stringify(parsedSchema, null, 2)}
												</pre>
											)}
										</AccordionPrimitive.Content>
									</AccordionPrimitive.Item>
								</AccordionPrimitive.Root>
							</div>
						)}

						{parsedTools && (
							<div>
								<h3 className="text-lg font-semibold text-foreground mb-3">
									Tools
								</h3>

								<AccordionPrimitive.Root
									type="single"
									collapsible
									className="bg-card border border-border rounded-xl overflow-hidden"
								>
									<AccordionPrimitive.Item value="tools-item">
										<AccordionPrimitive.Header>
											<AccordionPrimitive.Trigger className="group flex items-center w-full text-left text-sm font-medium text-foreground hover:underline bg-muted p-3">
												<ChevronDown className="h-4 w-4 text-muted-foreground mr-2 transition-transform group-data-[state=open]:rotate-180" />
												<SquareTerminal className="h-4 w-4 mr-2" />
												<span>tools</span>
											</AccordionPrimitive.Trigger>
										</AccordionPrimitive.Header>
										<AccordionPrimitive.Content className="bg-card">
											<div className="mb-4 inline-flex overflow-hidden px-4 pt-4">
												<button type="button"
													onClick={() => setToolsViewMode("tree")}
													className={cn(
														"px-4 py-1.5 text-sm font-medium focus:outline-none rounded-l-md border",
														toolsViewMode === "tree"
															? "bg-card text-foreground border-[#2b6cb0] text-[#2b6cb0]"
															: "bg-card text-muted-foreground border-border hover:bg-muted",
													)}
												>
													Tree
												</button>
												<button type="button"
													onClick={() => setToolsViewMode("raw")}
													className={cn(
														"px-4 py-1.5 text-sm font-medium focus:outline-none rounded-r-md border",
														toolsViewMode === "raw"
															? "bg-card text-foreground border-[#2b6cb0] text-[#2b6cb0]"
															: "bg-card text-muted-foreground border-border hover:bg-muted",
													)}
												>
													Raw
												</button>
											</div>

											{toolsViewMode === "tree" ? (
												<div className="p-4 pt-0 rounded text-xs text-foreground overflow-auto">
													<JSONTree
														data={parsedTools}
														theme={activeJsonTheme}
														invertTheme={false}
													/>
												</div>
											) : (
												<pre className="p-4 pt-0 rounded text-xs text-foreground overflow-auto">
													{JSON.stringify(parsedTools, null, 2)}
												</pre>
											)}
										</AccordionPrimitive.Content>
									</AccordionPrimitive.Item>
								</AccordionPrimitive.Root>
							</div>
						)}

						{/* Audit Section */}
						{auditData && (
							<div>
								<h3 className="text-lg font-semibold text-foreground mb-3">
									Audit
								</h3>
								<Card className="bg-muted border border-border shadow-sm rounded-md">
									<CardContent className="p-6 flex flex-row gap-8">
										<div className="flex flex-col items-start justify-between min-w-[237px]">
											<div className="flex flex-col items-start">
												<div className="flex items-center text-[#2b6cb0] gap-1">
													<BarChart2 className="w-4 h-4" />
													<span className="text-sm font-semibold">
														Score {auditData.rate}/100
													</span>
												</div>

												<div className="flex flex-row items-center gap-2 mt-2">
													<div className="w-full min-w-[191px] h-2 bg-muted dark:bg-[#000] rounded-full overflow-hidden">
														<div
															className="h-full bg-gradient-to-r from-sky-500 to-green-500 transition-all duration-300"
															style={{ width: `${auditData.rate}%` }}
														/>
													</div>
													<span className="text-[10px] text-[#2b6cb0] font-medium">
														{auditData.rate}%
													</span>
												</div>
											</div>
											<Button
												variant="outline"
												size="sm"
												onClick={handleOpenAuditModal}
												className="text-[12px]"
											>
												Audit details
											</Button>
										</div>

										<div className="flex flex-col gap-2 bg-card rounded-md p-3 border border-border">
											<p className="text-sm text-foreground">
												{auditData.summary}
											</p>
										</div>
									</CardContent>
								</Card>
							</div>
						)}

						{/* Prompt Content */}
						{data?.version?.value?.trim() && (
							<div>
								<h3 className="text-lg font-semibold text-foreground mb-3">
									Prompt Content
								</h3>
								<Card className="bg-muted rounded-md border border-border shadow-sm max-h-[300px] overflow-auto">
									<CardContent className="p-6">
										<div className="text-sm text-foreground break-words break-all hyphens-auto whitespace-pre-line">
											{data?.version?.value}
										</div>
									</CardContent>
								</Card>
							</div>
						)}
					</div>

					{/* Audit Results Modal */}
					{auditData && (
						<AuditResultsModal
							promptId={id || ""}
							promptValue={data?.version?.value || ""}
							existingAuditData={auditData}
							isOpen={showAuditModal}
							onClose={handleCloseAuditModal}
							onAuditComplete={() => {}}
							isDisabledFix={true}
							setDiffModalInfo={() => {}}
						/>
					)}
				</>
			)}
		</div>
	);
}
