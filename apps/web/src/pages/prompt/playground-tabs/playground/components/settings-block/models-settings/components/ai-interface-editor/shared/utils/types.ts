import type { VisualSchema, VisualProperty } from "./schemaHelpers";

export enum TabsValue {
	VISUAL = "VISUAL",
	CODE = "CODE",
}

export interface SchemaEditDialogProps {
	open: boolean;
	setOpen: (open: boolean) => void;
	promptId: number | undefined;
	jsonSchema: string | null;
	onSave: (data: { response_format: "json_schema"; json_schema: string }) => void;
}

export interface EditorTabsProps {
	activeTab: string;
	onTabChange: (value: string) => void;
	promptId: number | undefined;
	schema: VisualSchema;
	code: string;
	onCodeChange: (value: string | undefined) => void;
	onVisualChange: (schema: VisualSchema) => void;
	onSchemaReceived: (aiSchema: any) => void;
	onEditorMount?: (editor: any) => void;
}

export interface ValidationAlertProps {
	errors: string[];
}

export interface PropertyItemProps {
	property: VisualProperty;
	level?: number;
	onUpdate: (property: VisualProperty) => void;
	onRemove: () => void;
	disabled?: boolean;
	onDeleteSpecial?: () => void;
	isStrict?: boolean;
}

export interface VisualSchemaEditorProps {
	schema: VisualSchema;
	onChange: (schema: VisualSchema) => void;
	showExtraOptions?: boolean;
	enableChainOfThoughts?: boolean;
	enablePromptStatus?: boolean;
	emptyTitle?: string;
	emptyDescription?: string;
}

export interface SchemaOptionsProps {
	schema: VisualSchema;
	onChange: (schema: VisualSchema) => void;
	showCoT: boolean;
	showStatus: boolean;
	onStrictToggle: (val: boolean | "indeterminate") => void;
}
