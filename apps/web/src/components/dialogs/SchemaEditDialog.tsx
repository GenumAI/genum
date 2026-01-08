import React, { useState, useEffect, useRef } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import VisualSchemaEditor from "@/pages/prompt/playground-tabs/playground/settings-block/models-settings/misc/JSON Modal/VisualSchemaEditor";
import validator from "@/pages/prompt/playground-tabs/playground/settings-block/models-settings/misc/JSON Modal/validator";
import { useTheme } from "@/components/theme/theme-provider";
import {
	transformToJsonSchema,
	transformToVisualSchema,
	checkVisualDuplicates,
	baseSchema,
	VisualSchema,
	VisualProperty,
} from "@/pages/prompt/playground-tabs/playground/settings-block/models-settings/misc/JSON Modal/schemaHelpers";

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TriangleAlert } from "lucide-react";
import { PromptSettings } from "@/types/Prompt";
import AISchemaButton from "@/pages/prompt/playground-tabs/playground/settings-block/models-settings/misc/AISchemaButton";

// Re-export types for external use if needed
export type { VisualSchema, VisualProperty };

interface SchemaEditDialogProps {
	open: boolean;
	setOpen: (open: boolean) => void;
	promptId: number | undefined;
	modelParameters: PromptSettings["languageModelConfig"];
	onSave: (data: { response_format: "json_schema"; json_schema: string }) => void;
}

enum TabsValue {
	VISUAL = "VISUAL",
	CODE = "CODE",
}

const SchemaEditDialog = ({
	open,
	setOpen,
	promptId,
	modelParameters,
	onSave,
}: SchemaEditDialogProps) => {
	const editorRef = useRef<any>(null); // Monaco editor instance
	const [schema, setSchema] = useState<VisualSchema>({
		name: "output_schema",
		type: "object",
		properties: [],
		strict: false,
		chainOfThoughts: false,
		promptStatus: false,
	});
	const [validationErrors, setValidationErrors] = useState<string[]>([]);
	const [activeTab, setActiveTab] = useState<string>(TabsValue.VISUAL);
	const [code, setCode] = useState<string>("");
	const { resolvedTheme } = useTheme();
	const monacoTheme = resolvedTheme === "dark" ? "vs-dark" : "vs";

	// Initialize when modal opens
	useEffect(() => {
		try {
			const schemaToParse =
				typeof modelParameters.json_schema === "string"
					? JSON.parse(modelParameters.json_schema)
					: modelParameters.json_schema || {};

			// if an empty object is received, use the default schema
			if (Object.keys(schemaToParse).length === 0) {
				setSchema({ ...baseSchema, properties: [] });
			} else {
				const visualSchema = transformToVisualSchema(schemaToParse);
				setSchema(visualSchema);
			}
			setValidationErrors([]);
			setActiveTab(TabsValue.VISUAL);
		} catch (error) {
			console.error("Error loading existing schema:", error);
			// If failed to load existing schema, initialize with empty
			setSchema({ ...baseSchema, properties: [] });
			setValidationErrors(["Error loading existing schema"]);
		}
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		return () => {
			if (editorRef.current) {
				setTimeout(() => {
					// check for the existence of the dispose method (protection against state races)
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

	const validateSchema = (
		jsonSchema: any,
		visualSchema?: VisualSchema,
		strict: boolean = false,
	) => {
		const errors = validator.validate(jsonSchema, strict);

		if (visualSchema) {
			const dupErrors = checkVisualDuplicates(visualSchema);
			errors.push(...dupErrors);
		}

		setValidationErrors(errors);
		return errors;
	};

	const handleVisualChange = (newSchema: VisualSchema) => {
		setSchema(newSchema);
		const jsonSchema = transformToJsonSchema(newSchema);
		// Soft validation (strict=false) during editing
		validateSchema(jsonSchema.schema, newSchema, false);
	};

	const handleCodeChange = (value: string | undefined) => {
		const newCode = value || "";
		setCode(newCode);

		try {
			const parsed = JSON.parse(newCode);
			// Soft validation (strict=false) during typing
			const errors = validator.validate(parsed.schema, false);
			setValidationErrors(errors);
		} catch {
			setValidationErrors(["Invalid JSON syntax"]);
		}
	};

	const handleTabChange = (value: string) => {
		if (value === TabsValue.CODE) {
			const jsonSchema = transformToJsonSchema(schema);
			setCode(JSON.stringify(jsonSchema, null, 2));
			setActiveTab(TabsValue.CODE);
			// Strict validation is NOT required for switching, but good to check current state
			validateSchema(jsonSchema.schema, schema, false);
		} else {
			try {
				const parsed = JSON.parse(code);
				// We allow switching even with "soft" errors (like empty names),
				// but we must ensure the structure is valid enough for visual editor.
				// The validator handles structure checks.
				const errors = validator.validate(parsed.schema, false);

				if (errors.length === 0) {
					const visual = transformToVisualSchema(parsed);
					const dupErrors = checkVisualDuplicates(visual);

					if (dupErrors.length === 0) {
						setSchema(visual);
						setValidationErrors([]);
						setActiveTab(TabsValue.VISUAL);
						return;
					} else {
						// If duplicates found, we can't safely switch to visual editor as it relies on unique keys
						setValidationErrors(dupErrors);
						return;
					}
				}

				// If invalid structure, revert to last working state
				setActiveTab(TabsValue.VISUAL);
				const currentJson = transformToJsonSchema(schema);
				validateSchema(currentJson.schema, schema, false);
			} catch (e) {
				// JSON parse error, revert
				setActiveTab(TabsValue.VISUAL);
				const currentJson = transformToJsonSchema(schema);
				validateSchema(currentJson.schema, schema, false);
			}
		}
	};

	const handleSave = async () => {
		let jsonSchemaToSave;

		if (activeTab === TabsValue.CODE) {
			try {
				const parsed = JSON.parse(code);
				// STRICT validation on save
				const errors = validator.validate(parsed.schema, true);
				if (errors.length > 0) {
					setValidationErrors(errors);
					return;
				}
				jsonSchemaToSave = parsed;
			} catch {
				setValidationErrors(["Invalid JSON"]);
				return;
			}
		} else {
			const jsonSchema = transformToJsonSchema(schema);
			// STRICT validation on save
			const errors = validateSchema(jsonSchema.schema, schema, true);
			if (errors.length > 0) {
				return;
			}
			jsonSchemaToSave = jsonSchema;
		}

		if (!promptId) {
			console.error("Prompt ID is missing");
			return;
		}

		try {
			onSave({
				response_format: "json_schema",
				json_schema: JSON.stringify(jsonSchemaToSave),
			});
			setOpen(false);
		} catch (error) {
			console.error("Error saving structured output config:", error);
			setValidationErrors(["Error saving configuration."]);
		}
	};

	const handleSchemaReceived = (aiSchema: any) => {
		try {
			// Parse the AI-generated schema and convert to visual schema format
			let parsedSchema;
			if (typeof aiSchema === "string") {
				parsedSchema = JSON.parse(aiSchema);
			} else if (aiSchema && typeof aiSchema === "object" && aiSchema.schema) {
				// If the response has a nested schema property, use that
				parsedSchema = aiSchema.schema;
			} else {
				parsedSchema = aiSchema;
			}

			// Ensure the schema has the expected structure
			if (!parsedSchema || typeof parsedSchema !== "object") {
				throw new Error("Invalid schema format");
			}

			// If the schema doesn't have the expected structure, wrap it
			// we assume that AI can return a schema without a name/schema wrapper, try to normalize it
			const schemaToTransform = parsedSchema.schema
				? parsedSchema
				: {
						name: "ai_generated_schema",
						strict: true,
						schema: parsedSchema,
					};

			const visualSchema = transformToVisualSchema(schemaToTransform);

			setSchema(visualSchema);
			setValidationErrors([]);
			setActiveTab(TabsValue.VISUAL);
		} catch (error) {
			console.error("Error applying AI schema:", error);
			setValidationErrors(["Error applying AI-generated schema"]);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="max-w-[612px] max-h-[90vh] flex flex-col">
				<DialogHeader>
					<DialogTitle>Structured Output Schema</DialogTitle>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto py-4">
					<Tabs value={activeTab} onValueChange={handleTabChange}>
						<div className="flex items-center justify-between mb-4">
							<TabsList>
								<TabsTrigger value={TabsValue.VISUAL}>Visual Editor</TabsTrigger>
								<TabsTrigger value={TabsValue.CODE}>Code Editor</TabsTrigger>
							</TabsList>
							{promptId && (
								<AISchemaButton
									promptId={promptId}
									onSchemaReceived={handleSchemaReceived}
									existingSchema={transformToJsonSchema(schema)}
								/>
							)}
						</div>
						{!!validationErrors.length && (
							<Alert variant="destructive" className="mb-4">
								<TriangleAlert className="h-4 w-4" />
								<AlertTitle>Schema Validation Errors</AlertTitle>
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
							<VisualSchemaEditor
								schema={schema}
								onChange={handleVisualChange}
								enableChainOfThoughts={true}
								enablePromptStatus={true}
							/>
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
					<Button variant="outline" onClick={() => setOpen(false)}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={validationErrors.length > 0}>
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export default SchemaEditDialog;
