import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useRef } from "react";
import { TriangleAlert } from "lucide-react";
import Editor, { OnMount } from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme/theme-provider";
import AIToolsButton from "@/pages/prompt/playground-tabs/playground/settings-block/models-settings/misc/AIToolsButton";
import VisualSchemaEditor from "@/pages/prompt/playground-tabs/playground/settings-block/models-settings/misc/JSON Modal/VisualSchemaEditor";
import {
	transformToJsonSchema,
	transformToVisualSchema,
	checkVisualDuplicates,
	VisualSchema,
	baseSchema,
} from "@/pages/prompt/playground-tabs/playground/settings-block/models-settings/misc/JSON Modal/schemaHelpers";
import validator from "@/pages/prompt/playground-tabs/playground/settings-block/models-settings/misc/JSON Modal/validator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ToolsModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	llmConfig?: any;
	promptId?: number;
	tools?: any[];
	setTools?: (tools: any[]) => void;
	editingTool?: any;
}

enum TabsValue {
	VISUAL = "VISUAL",
	CODE = "CODE",
}

// Helper to construct full tool JSON from parts
const constructToolJson = (name: string, description: string, visualSchema: VisualSchema) => {
	const jsonSchema = transformToJsonSchema(visualSchema);
	return {
		type: "function", // OpenAI tools strict mode requires type: 'function'
		function: {
			name: name,
			description: description,
			parameters: jsonSchema.schema, // We extract just the schema part for parameters
			strict: visualSchema.strict,
		},
	};
};

// Helper to construct Tool JSON for the old format if needed,
// but OpenAI tools usually have { type: "function", function: { name, description, parameters } }
// The previous implementation had { name, description, parameters } directly at root which is slightly different from OpenAI standard "tool" object
// but might be how the backend expects it.
// Let's look at previous implementation:
// It returned: { name, description, parameters: { type: 'object', properties..., required... } }
// It seems it was returning the inner "function" object or a simplified version.
// Let's stick to the structure the user likely expects: { name, description, parameters: ... }
// However, let's support strict mode which is usually at the same level as name/desc in some APIs or inside function.
// If we look at `SchemaEditDialog`, it creates `{ name, strict, schema }`.
// For a Tool, we probably want:
// { name, description, strict: boolean, parameters: schema }
// OR just { name, description, parameters: schema } and strict is implied or inside parameters?
// OpenAI: { type: "function", function: { name, description, parameters: {...}, strict: true } }
// Let's assume we return the object that represents the function definition.

const createToolObject = (name: string, description: string, visualSchema: VisualSchema) => {
	const jsonSchema = transformToJsonSchema(visualSchema);
	return {
		name,
		description,
		strict: visualSchema.strict,
		parameters: jsonSchema.schema,
	};
};

export default function ToolsModal({
	open,
	onOpenChange,
	tools,
	setTools,
	editingTool,
	promptId,
}: ToolsModalProps) {
	const [activeTab, setActiveTab] = useState<string>(TabsValue.VISUAL);
	const [toolName, setToolName] = useState("");
	const [toolDescription, setToolDescription] = useState("");
	const [schema, setSchema] = useState<VisualSchema>({ ...baseSchema, properties: [] });
	const [code, setCode] = useState<string>("");
	const [validationErrors, setValidationErrors] = useState<string[]>([]);
	const editorRef = useRef<any>(null);
	const [nameExistsError, setNameExistsError] = useState(false);

	const { resolvedTheme } = useTheme();
	const monacoTheme = resolvedTheme === "dark" ? "vs-dark" : "vs";

	useEffect(() => {
		if (open) {
			// Reset or Initialize
			if (editingTool) {
				setToolName(editingTool.name || "");
				setToolDescription(editingTool.description || "");

				// Try to parse parameters
				try {
					const params = editingTool.parameters || {};
					// Convert parameters to VisualSchema
					// We need to mock a root schema object for transformToVisualSchema
					const mockSchemaForTransform = {
						name: editingTool.name,
						strict: editingTool.strict,
						schema: params, // The parameters object IS the schema
					};
					const visual = transformToVisualSchema(mockSchemaForTransform);
					setSchema(visual);
				} catch (e) {
					console.error("Error parsing tool parameters", e);
					setSchema({ ...baseSchema, properties: [] });
				}
			} else {
				setToolName("");
				setToolDescription("");
				setSchema({ ...baseSchema, properties: [] });
			}
			setActiveTab(TabsValue.VISUAL);
			setValidationErrors([]);
			setNameExistsError(false);
			setCode("");
		}
	}, [open, editingTool]);

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

	const handleEditorDidMount: OnMount = (editor) => {
		editorRef.current = editor;
	};

	const validateTool = (currentName: string, currentSchema: VisualSchema, strict: boolean) => {
		const errors: string[] = [];
		if (!currentName.trim()) errors.push("Tool name is required");

		// Check duplicates in tools list
		if (tools && currentName.trim()) {
			const lowerName = currentName.trim().toLowerCase();
			const editingName = editingTool?.name?.trim().toLowerCase();
			const exists = tools.some(
				(t) => t.name?.trim().toLowerCase() === lowerName && lowerName !== editingName,
			);
			if (exists) {
				errors.push("Tool with this name already exists");
				setNameExistsError(true);
			} else {
				setNameExistsError(false);
			}
		}

		// Validate Schema
		const jsonSchema = transformToJsonSchema(currentSchema);
		const schemaErrors = validator.validate(jsonSchema.schema, strict);
		errors.push(...schemaErrors);

		const visualDupErrors = checkVisualDuplicates(currentSchema);
		errors.push(...visualDupErrors);

		setValidationErrors(errors);
		return errors;
	};

	const handleVisualChange = (newSchema: VisualSchema) => {
		setSchema(newSchema);
		// Soft validation
		validateTool(toolName, newSchema, false);
	};

	const handleNameChange = (val: string) => {
		setToolName(val);
		validateTool(val, schema, false);
	};

	const handleTabChange = (value: string) => {
		if (value === TabsValue.CODE) {
			// Visual -> Code
			const toolObj = createToolObject(toolName, toolDescription, schema);
			setCode(JSON.stringify(toolObj, null, 2));
			setActiveTab(TabsValue.CODE);
			validateTool(toolName, schema, false);
		} else {
			// Code -> Visual
			try {
				const parsed = JSON.parse(code);

				// We expect { name, description, strict, parameters }
				// Validate structure lightly
				if (typeof parsed !== "object" || !parsed) throw new Error("Invalid JSON");

				// Extract parts
				const newName = parsed.name || "";
				const newDesc = parsed.description || "";
				const newStrict = parsed.strict || false;
				const newParams = parsed.parameters || {};

				// Validate schema structure via validator
				// Note: validator expects a schema object.
				const schemaErrors = validator.validate(newParams, false);

				if (schemaErrors.length === 0) {
					// Transform parameters to visual
					const mockSchema = {
						name: newName,
						strict: newStrict,
						schema: newParams,
					};
					const visual = transformToVisualSchema(mockSchema);
					const dupErrors = checkVisualDuplicates(visual);

					if (dupErrors.length === 0) {
						setToolName(newName);
						setToolDescription(newDesc);
						setSchema(visual);
						setValidationErrors([]);
						setActiveTab(TabsValue.VISUAL);
						return;
					} else {
						setValidationErrors(dupErrors);
						return;
					}
				}

				// If invalid, revert (or stay in code mode with errors)
				// But we want to block switching if it's broken
				setActiveTab(TabsValue.VISUAL); // Revert to visual state
				// Recalculate validation for current visual state
				validateTool(toolName, schema, false);
			} catch (e) {
				// Parse error
				setActiveTab(TabsValue.VISUAL); // Revert
				validateTool(toolName, schema, false);
			}
		}
	};

	const handleCodeChange = (value: string | undefined) => {
		const newCode = value || "";
		setCode(newCode);
		try {
			const parsed = JSON.parse(newCode);
			// Soft validation of the JSON structure content
			// We need to validate the 'parameters' part specifically
			const params = parsed.parameters || {};
			const schemaErrors = validator.validate(params, false);

			// Check name
			const nameErrors = [];
			if (!parsed.name) nameErrors.push("Name is missing in JSON");

			setValidationErrors([...nameErrors, ...schemaErrors]);
		} catch {
			setValidationErrors(["Invalid JSON syntax"]);
		}
	};

	const handleSave = () => {
		let toolToSave;

		if (activeTab === TabsValue.CODE) {
			try {
				const parsed = JSON.parse(code);
				// Strict validation
				const params = parsed.parameters || {};
				const schemaErrors = validator.validate(params, true);

				if (!parsed.name) {
					setValidationErrors(["Tool name is required", ...schemaErrors]);
					return;
				}

				if (schemaErrors.length > 0) {
					setValidationErrors(schemaErrors);
					return;
				}
				toolToSave = parsed;
			} catch {
				setValidationErrors(["Invalid JSON"]);
				return;
			}
		} else {
			const errors = validateTool(toolName, schema, true);
			if (errors.length > 0) return;
			toolToSave = createToolObject(toolName, toolDescription, schema);
		}

		if (setTools) {
			// Update tools list
			// If we are editing, we might need to replace.
			// But setTools usually accepts the new list.
			// The parent component logic for setTools wasn't fully visible,
			// but the previous implementation did: setTools([toolToJson(tool)]) which implied it set a single tool?
			// OR it was a list.
			// Looking at previous code: `if (setTools) setTools([toolToJson(tool)]);`
			// Wait, it was wrapping it in an array?
			// Ah, `tools` prop is `any[]`. `setTools` is `(tools: any[]) => void`.
			// If `editingTool` is present, we probably want to update it in the list.
			// But the previous code just did `setTools([tool])`.
			// This implies it might be a single tool modal context or it overwrites everything?
			// Let's assume it's adding/updating a tool in a list if the user intended that,
			// BUT the previous code clearly just made a new array with ONE tool.
			// Let's stick to what the previous code did: `setTools([toolToSave])`.
			// However, usually you want to append or update.
			// If the user context implies this modal manages a SINGLE tool for a prompt, then replacing is fine.
			setTools([toolToSave]);
		}
		onOpenChange(false);
	};

	const handleToolReceived = (aiTool: any) => {
		try {
			let parsedTool;
			if (typeof aiTool === "string") {
				parsedTool = JSON.parse(aiTool);
			} else {
				parsedTool = aiTool;
			}

			// Support both { type: 'function', function: {...} } and direct { name, ... }
			const toolData = parsedTool.function || parsedTool;

			if (!toolData || typeof toolData !== "object") throw new Error("Invalid tool format");

			const newName = toolData.name || "";
			const newDesc = toolData.description || "";
			const newStrict = toolData.strict || false;
			const newParams = toolData.parameters || {};

			// Transform params
			const mockSchema = {
				name: newName,
				strict: newStrict,
				schema: newParams,
			};
			const visual = transformToVisualSchema(mockSchema);

			setToolName(newName);
			setToolDescription(newDesc);
			setSchema(visual);
			setValidationErrors([]);
			setActiveTab(TabsValue.VISUAL);
		} catch (e) {
			console.error("Error applying AI tool:", e);
			setValidationErrors(["Error applying AI-generated tool"]);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-[612px] max-h-[90vh] flex flex-col">
				<DialogHeader>
					<DialogTitle>{editingTool ? "Edit Function" : "Add Function"}</DialogTitle>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto py-4">
					<Tabs value={activeTab} onValueChange={handleTabChange}>
						<div className="flex items-center justify-between mb-4">
							<TabsList>
								<TabsTrigger value={TabsValue.VISUAL}>Visual Editor</TabsTrigger>
								<TabsTrigger value={TabsValue.CODE}>JSON Editor</TabsTrigger>
							</TabsList>
							{promptId && (
								<AIToolsButton
									promptId={promptId}
									onToolReceived={handleToolReceived}
									existingTool={createToolObject(
										toolName,
										toolDescription,
										schema,
									)}
								/>
							)}
						</div>

						{!!validationErrors.length && (
							<Alert variant="destructive" className="mb-4">
								<TriangleAlert className="h-4 w-4" />
								<AlertTitle>Validation Errors</AlertTitle>
								<AlertDescription>
									<ul className="list-inside space-y-1">
										{validationErrors.map((error, index) => (
											<li key={index}>{error}</li>
										))}
									</ul>
								</AlertDescription>
							</Alert>
						)}

						<TabsContent value={TabsValue.VISUAL}>
							<div className="flex flex-col gap-4">
								<div>
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
								<div>
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

								<div className="mt-2">
									<div className="text-[15px] font-medium mb-2">Parameters</div>
									<VisualSchemaEditor
										schema={schema}
										onChange={handleVisualChange}
										enableChainOfThoughts={true}
										enablePromptStatus={false}
									/>
								</div>
							</div>
						</TabsContent>

						<TabsContent value={TabsValue.CODE}>
							<Editor
								height="400px"
								defaultLanguage="json"
								theme={monacoTheme}
								value={code}
								onChange={handleCodeChange}
								onMount={handleEditorDidMount}
								options={{
									fontFamily: "Inter, sans-serif",
									fontSize: 14,
									contextmenu: false,
									minimap: { enabled: false },
									scrollbar: {
										vertical: "auto",
										horizontal: "auto",
										verticalScrollbarSize: 5,
									},
									lineNumbers: "on",
									automaticLayout: true,
								}}
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
