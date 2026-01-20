import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { VisualSchemaEditorProps } from "../utils/types";
import { PropertyItem } from "./components/PropertyItem";
import { SchemaOptions } from "./components/SchemaOptions";
import { useSchemaEditor } from "../../json-schema-editor/hooks/useSchemaEditor";
import type { VisualProperty } from "../utils/schemaHelpers";
import { EmptyState } from "@/pages/info-pages/EmptyState";

const VisualSchemaEditor = ({
	schema,
	onChange,
	showExtraOptions = true,
	enableChainOfThoughts,
	enablePromptStatus,
	emptyTitle = "No properties defined",
	emptyDescription = "Add properties to define the structure of the JSON schema output",
}: VisualSchemaEditorProps) => {
	const showCoT = enableChainOfThoughts !== undefined ? enableChainOfThoughts : showExtraOptions;
	const showStatus = enablePromptStatus !== undefined ? enablePromptStatus : showExtraOptions;

	const { handleAddProperty, handleStrictToggle, handleUpdate, handleRemove, isAddDisabled } =
		useSchemaEditor({ schema, onChange });

	const properties = schema.properties || [];

	return (
		<div className="flex-1 flex flex-col min-h-0 pt-4 pl-1">
			<div className="flex-shrink-0">
				<SchemaOptions
					schema={schema}
					onChange={onChange}
					showCoT={showCoT}
					showStatus={showStatus}
					onStrictToggle={handleStrictToggle}
				/>
			</div>

			<div className="flex-1 overflow-y-auto my-4 min-h-0 flex flex-col">
				{properties.length > 0 ||
				(showCoT && schema.chainOfThoughts) ||
				(showStatus && schema.promptStatus) ? (
					<div className="space-y-4">
						{properties.map((p: VisualProperty, i: number) => (
							<PropertyItem
								key={p.id || `property-${i}`}
								property={p}
								onUpdate={(u: VisualProperty) => handleUpdate(i, u)}
								onRemove={() => handleRemove(i)}
								isStrict={schema.strict}
							/>
						))}

						{showCoT && schema.chainOfThoughts && (
							<PropertyItem
								property={{
									name: "chainOfThoughts",
									type: "string",
									required: true,
									description: "Reasoning steps",
									isArray: false,
								}}
								onUpdate={() => {}}
								onRemove={() => {}}
								disabled
							/>
						)}

						{showStatus && schema.promptStatus && (
							<PropertyItem
								property={{
									name: "status",
									type: "string",
									required: true,
									description: "Prompt execution status",
									isArray: false,
								}}
								onUpdate={() => {}}
								onRemove={() => {}}
								disabled
							/>
						)}
					</div>
				) : (
					<div className="flex-1 flex items-center justify-center">
						<EmptyState
							title={emptyTitle}
							description={emptyDescription}
							minHeight="200px"
							className="border-none"
						/>
					</div>
				)}
			</div>

			<div className="flex-shrink-0 pb-2">
				<Button
					variant="outline"
					onClick={handleAddProperty}
					disabled={isAddDisabled}
					className="w-full flex items-center justify-center gap-2"
				>
					<Plus className="w-4 h-4" /> Add property
				</Button>
			</div>
		</div>
	);
};

export default VisualSchemaEditor;
