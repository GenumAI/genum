import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import AIGenerateButton from "../shared/AIGenerateButton";
import VisualSchemaEditor from "../shared/visual-editor/VisualSchemaEditor";
import CodeSchemaEditor from "../shared/code-editor/CodeSchemaEditor";
import { ValidationAlert } from "../shared/code-editor/components/ValidationAlert";

// Hooks
import { useToolState } from "./hooks/useToolState";
import { useToolValidation } from "./hooks/useToolValidation";
import { useToolTabSwitch } from "./hooks/useToolTabSwitch";
import { useToolSave } from "./hooks/useToolSave";
import { useAITool } from "./hooks/useAITool";
import { TabsValue } from "../shared/utils/types";
import type { ToolItem } from "../../../utils/types";

interface ToolsModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	promptId?: number;
	tools?: ToolItem[];
	setTools?: (tools: ToolItem[]) => void;
	editingTool?: ToolItem | null;
}

export default function ToolsModal({
	open,
	onOpenChange,
	tools,
	setTools,
	editingTool,
	promptId,
}: ToolsModalProps) {
	const editorRef = useRef<{ dispose: () => void } | null>(null);

	// State management
	const {
		toolName,
		setToolName,
		toolDescription,
		setToolDescription,
		schema,
		setSchema,
		code,
		setCode,
		activeTab,
		setActiveTab,
		validationErrors,
		setValidationErrors,
		setNameExistsError,
	} = useToolState({ editingTool, open });

	// Validation
	const { validateTool, validateCodeTool } = useToolValidation({
		tools,
		editingTool,
		setValidationErrors,
		setNameExistsError,
	});

	// Tab switching
	const { handleTabChange, createToolObject } = useToolTabSwitch({
		toolName,
		toolDescription,
		schema,
		code,
		setToolName,
		setToolDescription,
		setSchema,
		setCode,
		setActiveTab,
		setValidationErrors,
		validateTool,
	});

	// Save functionality
	const { handleSave } = useToolSave({
		activeTab,
		code,
		toolName,
		toolDescription,
		schema,
		setValidationErrors,
		validateTool,
		setTools,
		onOpenChange,
	});

	// AI tool generation
	const { handleToolReceived } = useAITool({
		setToolName,
		setToolDescription,
		setSchema,
		setValidationErrors,
		setActiveTab,
	});

	// Cleanup editor on unmount
	useEffect(() => {
		return () => {
			if (editorRef.current) {
				setTimeout(() => {
					if (editorRef.current?.dispose) {
						editorRef.current.dispose();
					}
					editorRef.current = null;
				}, 500);
			}
		};
	}, []);

	const handleEditorDidMount = (editor: { dispose: () => void }) => {
		editorRef.current = editor;
	};

	const handleVisualChange = (newSchema: typeof schema) => {
		setSchema(newSchema);
		validateTool(toolName, newSchema, false);
	};

	const handleNameChange = (val: string) => {
		setToolName(val);
		validateTool(val, schema, false);
	};

	const handleCodeChange = (value: string | undefined) => {
		const newCode = value || "";
		setCode(newCode);
		validateCodeTool(newCode, false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[800px] h-[800px] max-h-[90vh] flex flex-col">
				<DialogHeader>
					<DialogTitle>{editingTool ? "Edit Function" : "Add Function"}</DialogTitle>
				</DialogHeader>

				<div className="flex-1 flex flex-col overflow-hidden">
					<Tabs
						value={activeTab}
						onValueChange={handleTabChange}
						className="flex-1 flex flex-col overflow-hidden"
					>
						<div className="flex items-center justify-between mb-4 flex-shrink-0">
							<TabsList>
								<TabsTrigger value={TabsValue.VISUAL}>Visual Editor</TabsTrigger>
								<TabsTrigger value={TabsValue.CODE}>JSON Editor</TabsTrigger>
							</TabsList>
							{promptId && (
								<AIGenerateButton
									mode="tool"
									promptId={promptId}
									onReceived={handleToolReceived}
									existingData={createToolObject(
										toolName,
										toolDescription,
										schema,
									)}
								/>
							)}
						</div>

						<ValidationAlert errors={validationErrors} />

						<TabsContent
							value={TabsValue.VISUAL}
							className="flex-1 min-h-0 data-[state=active]:flex flex-col gap-4"
						>
							<div className="flex-1 flex flex-col gap-4 min-h-0">
								<div className="flex-shrink-0">
									<label
										className="block text-sm font-medium mb-1"
										htmlFor="tool-name"
									>
										Name
									</label>
									<Input
										id="tool-name"
										placeholder="Enter your tool_name"
										value={toolName}
										onChange={(e) => handleNameChange(e.target.value)}
									/>
								</div>
								<div className="flex-shrink-0">
									<label
										className="block text-sm font-medium mb-1"
										htmlFor="tool-description"
									>
										Description
									</label>
									<Input
										id="tool-description"
										placeholder="Short tool description"
										value={toolDescription}
										onChange={(e) => setToolDescription(e.target.value)}
									/>
								</div>

								<div className="mt-2 flex-1 flex flex-col min-h-0">
									<div className="text-[15px] font-medium mb-2 flex-shrink-0">
										Parameters
									</div>
									<VisualSchemaEditor
										schema={schema}
										onChange={handleVisualChange}
										enableChainOfThoughts={true}
										enablePromptStatus={false}
										emptyTitle="No function parameters"
										emptyDescription="Add parameters to define the inputs for this function tool"
									/>
								</div>
							</div>
						</TabsContent>

						<TabsContent
							value={TabsValue.CODE}
							className="flex-1 min-h-0 data-[state=active]:flex flex-col"
						>
							<CodeSchemaEditor
								code={code}
								onChange={handleCodeChange}
								onEditorMount={handleEditorDidMount}
								height="100%"
							/>
						</TabsContent>
					</Tabs>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={validationErrors.length > 0}>
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
