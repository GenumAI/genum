import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import MonacoEditor from "@/components/ui/MonacoEditor";
import VisualSchemaEditor from "../../visual-editor/VisualSchemaEditor";
import AIGenerateButton from "./AIGenerateButton";
import { transformToJsonSchema } from "../../utils/schemaHelpers";
import { TabsValue, type EditorTabsProps } from "../../utils/types";

export const EditorTabs = ({
	activeTab,
	onTabChange,
	promptId,
	schema,
	code,
	onCodeChange,
	onVisualChange,
	onSchemaReceived,
	onEditorMount,
}: EditorTabsProps) => {
	return (
		<Tabs value={activeTab} onValueChange={onTabChange}>
			<div className="flex items-center justify-between mb-4">
				<TabsList>
					<TabsTrigger value={TabsValue.VISUAL}>Visual Editor</TabsTrigger>
					<TabsTrigger value={TabsValue.CODE}>Code Editor</TabsTrigger>
				</TabsList>
				{promptId && (
					<AIGenerateButton
						mode="schema"
						promptId={promptId}
						onReceived={onSchemaReceived}
						existingData={transformToJsonSchema(schema)}
					/>
				)}
			</div>

			<TabsContent value={TabsValue.VISUAL}>
				<VisualSchemaEditor
					schema={schema}
					onChange={onVisualChange}
					enableChainOfThoughts={true}
					enablePromptStatus={true}
				/>
			</TabsContent>

			<TabsContent value={TabsValue.CODE}>
				<MonacoEditor
					height="400px"
					defaultLanguage="json"
					value={code}
					onChange={onCodeChange}
					onMount={onEditorMount}
					options={{
						lineNumbers: "on",
					}}
					ariaLabel="JSON Schema Code Editor"
				/>
			</TabsContent>
		</Tabs>
	);
};
