import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, MessageCircle, CirclePlus, CircleAlert, Asterisk } from "lucide-react";
import { cn } from "@/lib/utils";
import { VisualProperty, VisualSchema } from "@/components/dialogs/SchemaEditDialog";

type FieldType = "string" | "number" | "boolean" | "object" | "enum";

interface PropertyItemProps {
	property: VisualProperty;
	level?: number;
	onUpdate: (property: VisualProperty) => void;
	onRemove: () => void;
	disabled?: boolean;
	onDeleteSpecial?: () => void;
	isStrict?: boolean;
}

const PropertyItem = ({
	property,
	level = 0,
	onUpdate,
	onRemove,
	disabled = false,
	onDeleteSpecial,
	isStrict,
}: PropertyItemProps) => {
	const [showDescriptionModal, setShowDescriptionModal] = useState(false);

	const handleNameChange = (value: string) => onUpdate({ ...property, name: value });

	const handleTypeChange = (value: string) => {
		const typeValue = value as FieldType;

		const updatedProperty: VisualProperty = {
			...property,
			type: typeValue,
			properties: typeValue === "object" ? [] : undefined,
			enum: typeValue === "enum" ? [] : undefined,
		};
		onUpdate(updatedProperty);
	};

	const handleDescriptionChange = (value: string) =>
		onUpdate({ ...property, description: value });

	const handleRequiredToggle = () => onUpdate({ ...property, required: !property.required });

	const handleArrayToggle = () => {
		const isArray = !property.isArray;
		onUpdate({
			...property,
			isArray,
		});
	};

	const handleAddEnumValue = () => {
		onUpdate({ ...property, enum: [...(property.enum || []), ""] });
	};

	const handleEnumValueChange = (index: number, value: string) => {
		const updated = [...(property.enum || [])];
		updated[index] = value;
		onUpdate({ ...property, enum: updated });
	};

	const handleRemoveEnumValue = (index: number) => {
		const updated = (property.enum || []).filter((_, i) => i !== index);
		onUpdate({ ...property, enum: updated });
	};

	const handleNestedUpdate = (index: number, updatedProp: VisualProperty) => {
		const updated = [...(property.properties || [])];
		updated[index] = updatedProp;
		onUpdate({ ...property, properties: updated });
	};

	const handleNestedRemove = (index: number) => {
		const updated = (property.properties || []).filter((_, i: number) => i !== index);
		onUpdate({ ...property, properties: updated });
	};

	const handleAddNestedItem = () => {
		const newProp: VisualProperty = {
			name: "",
			type: "string",
			required: !!isStrict,
			isArray: false,
		};
		onUpdate({ ...property, properties: [...(property.properties || []), newProp] });
	};

	return (
		<div
			className={cn({
				"border p-4 rounded-xl mb-4":
					property.type === "object" || property.type === "enum",
			})}
			style={{ marginLeft: `${level * 24}px`, opacity: disabled ? 0.5 : 1 }}
		>
			<div className="flex items-center gap-3">
				<Input
					value={property.name}
					onChange={(e) => handleNameChange(e.target.value)}
					placeholder="Name"
					disabled={disabled}
					className="max-w-[254px]"
				/>
				<Select
					onValueChange={handleTypeChange}
					value={property.type || undefined}
					disabled={disabled}
				>
					<SelectTrigger className="w-[108px]">
						<SelectValue placeholder="Type" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="string">string</SelectItem>
						<SelectItem value="number">number</SelectItem>
						<SelectItem value="boolean">boolean</SelectItem>
						<SelectItem value="object">object</SelectItem>
						<SelectItem value="enum">enum</SelectItem>
					</SelectContent>
				</Select>

				<Button
					variant={property.isArray ? "default" : "outline"}
					onClick={handleArrayToggle}
					disabled={disabled}
					className={`h-8 w-9 px-2 ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
				>
					[ ]
				</Button>
				<Button
					variant={property.required ? "default" : "outline"}
					onClick={handleRequiredToggle}
					disabled={disabled}
					className={`h-8 w-9 px-2 flex items-center justify-center ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
				>
					<Asterisk />
				</Button>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								className={"ml-auto"}
								variant="ghost"
								size="icon"
								onClick={() => setShowDescriptionModal(true)}
								disabled={disabled}
							>
								<MessageCircle className="w-4 h-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent
							className="max-w-xs whitespace-normal bg-black text-white"
							sideOffset={5}
						>
							{property.description || "Add description"}
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<Button
					variant="ghost"
					size="icon"
					onClick={onDeleteSpecial || onRemove}
					disabled={disabled}
				>
					<Trash2 className="w-4 h-4" />
				</Button>
			</div>

			{property.type === "enum" && (
				<div className="ml-3 mt-2 space-y-2">
					{(property.enum || []).map((val: string, i: number) => (
						<div key={i} className="flex items-center gap-2">
							<Input
								value={val}
								onChange={(e) => handleEnumValueChange(i, e.target.value)}
								className="max-w-[222px]"
							/>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => handleRemoveEnumValue(i)}
							>
								<Trash2 className="w-4 h-4" />
							</Button>
						</div>
					))}
					<Button
						variant="link"
						onClick={handleAddEnumValue}
						className="text-blue-600 flex items-center gap-1"
					>
						<CirclePlus className="w-4 h-4 -ml-1" /> Add value
					</Button>
				</div>
			)}

			{property.type === "object" && (
				<>
					{(property.properties || []).map((p, i: number) => (
						<div key={i} className="-ml-4 mt-2 space-y-2">
							<PropertyItem
								key={i}
								property={p}
								level={level + 1}
								onUpdate={(updated) => handleNestedUpdate(i, updated)}
								onRemove={() => handleNestedRemove(i)}
								disabled={disabled}
								isStrict={isStrict}
							/>
						</div>
					))}
					<Button
						variant="link"
						onClick={handleAddNestedItem}
						className="-ml-1 text-blue-600 flex items-center gap-1"
					>
						<CirclePlus className="w-4 h-4" /> Add nested property
					</Button>
				</>
			)}

			<Dialog open={showDescriptionModal} onOpenChange={setShowDescriptionModal}>
				<DialogContent className="max-w-[612px]">
					<DialogHeader>
						<DialogTitle>Edit Description</DialogTitle>
					</DialogHeader>
					<Input
						value={property.description || ""}
						onChange={(e) => handleDescriptionChange(e.target.value)}
						placeholder="Enter property description"
					/>
					<DialogFooter>
						<Button onClick={() => setShowDescriptionModal(false)}>Close</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
};

interface VisualSchemaEditorProps {
	schema: VisualSchema;
	onChange: (schema: VisualSchema) => void;
	showExtraOptions?: boolean; // Deprecated in favor of specific flags, but kept for backward compatibility if needed (though we'll prefer specific flags)
	enableChainOfThoughts?: boolean;
	enablePromptStatus?: boolean;
}

const VisualSchemaEditor = ({
	schema,
	onChange,
	showExtraOptions = true,
	enableChainOfThoughts,
	enablePromptStatus,
}: VisualSchemaEditorProps) => {
	// Determine visibility based on props.
	// If explicit flags are provided, use them.
	// If not, fall back to showExtraOptions behavior (which toggles both).
	const showCoT = enableChainOfThoughts !== undefined ? enableChainOfThoughts : showExtraOptions;
	const showStatus = enablePromptStatus !== undefined ? enablePromptStatus : showExtraOptions;

	const handleAddProperty = () => {
		const newProp: VisualProperty = {
			name: "",
			type: "string",
			required: schema.strict,
			isArray: false,
		};
		onChange({ ...schema, properties: [...(schema.properties || []), newProp] });
	};

	const handleStrictToggle = (val: boolean | "indeterminate") => {
		const isStrict = val === true;

		const setAllRequired = (props: VisualProperty[]): VisualProperty[] => {
			return props.map((prop) => {
				const updatedProp = { ...prop, required: isStrict ? true : prop.required };
				if (updatedProp.properties) {
					updatedProp.properties = setAllRequired(updatedProp.properties);
				}
				return updatedProp;
			});
		};

		const updatedProperties = setAllRequired(schema.properties || []);
		onChange({ ...schema, strict: isStrict, properties: updatedProperties });
	};

	const checkAllRequired = (props: VisualProperty[]): boolean => {
		return props.every((p) => {
			if (!p.required) return false;
			if (p.properties && p.properties.length > 0) {
				return checkAllRequired(p.properties);
			}
			return true;
		});
	};

	const handleUpdate = (i: number, updated: VisualProperty) => {
		const updatedProps = [...schema.properties];
		updatedProps[i] = updated;

		let newStrict = schema.strict;

		if (schema.strict && !updated.required) {
			newStrict = false;
		} else if (!schema.strict && updated.required) {
			if (checkAllRequired(updatedProps)) {
				newStrict = true;
			}
		}

		if (newStrict) {
			if (!checkAllRequired(updatedProps)) {
				newStrict = false;
			}
		}

		onChange({ ...schema, properties: updatedProps, strict: newStrict });
	};

	const handleRemove = (i: number) => {
		const updatedProps = schema.properties.filter((_, idx) => idx !== i);
		onChange({ ...schema, properties: updatedProps });
	};

	const hasDuplicates = (props: VisualProperty[]) => {
		const names = props.map((p) => p.name);
		return names.some((name, index) => names.indexOf(name) !== index);
	};

	const isAddDisabled = hasDuplicates(schema.properties || []);

	const properties = schema.properties || [];

	return (
		<div className="space-y-4 pt-4 pl-1">
			<div className="flex gap-6 items-center">
				<label className="flex items-center space-x-2 cursor-pointer">
					<Checkbox checked={schema.strict} onCheckedChange={handleStrictToggle} />
					<span className="text-sm">Strict Mode</span>

					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<CircleAlert className="w-4 h-4" />
							</TooltipTrigger>
							<TooltipContent className="max-w-xs whitespace-normal" sideOffset={5}>
								When enabled, only properties defined in the schema will be allowed
								in the output
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</label>

				{showCoT && (
					<label className="flex items-center space-x-2 cursor-pointer">
						<Checkbox
							checked={schema.chainOfThoughts}
							onCheckedChange={(v) =>
								onChange({ ...schema, chainOfThoughts: v === true })
							}
						/>
						<span className="text-sm"> Chain Of Thoughts</span>

						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<CircleAlert className="w-4 h-4" />
								</TooltipTrigger>
								<TooltipContent
									className="max-w-xs whitespace-normal"
									sideOffset={5}
								>
									When enabled, the model will generate and return a step-by-step
									reasoning process along with the output. This feature can
									increase the cost of the request.
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</label>
				)}

				{showStatus && (
					<label className="flex items-center space-x-2 cursor-pointer">
						<Checkbox
							checked={schema.promptStatus}
							onCheckedChange={(v) =>
								onChange({ ...schema, promptStatus: v === true })
							}
						/>
						<span className="text-sm"> Prompt Status</span>

						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<CircleAlert className="w-4 h-4" />
								</TooltipTrigger>
								<TooltipContent
									className="max-w-xs whitespace-normal"
									sideOffset={5}
								>
									When enabled, the model will return the execution status of the
									prompt. This feature works only in testcase mode and can
									increase the cost of the request.
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</label>
				)}
			</div>
			{properties.map((p, i) => (
				<PropertyItem
					key={i}
					property={p}
					onUpdate={(u) => handleUpdate(i, u)}
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
			<Button
				variant="outline"
				onClick={handleAddProperty}
				disabled={isAddDisabled}
				className="w-full flex items-center justify-center gap-2"
			>
				<Plus className="w-4 h-4" /> Add property
			</Button>
		</div>
	);
};

export default VisualSchemaEditor;
