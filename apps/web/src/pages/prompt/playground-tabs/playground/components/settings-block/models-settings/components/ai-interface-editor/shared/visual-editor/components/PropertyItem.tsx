import { useState } from "react";
import { Input } from "@/components/ui/input";
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
import { Trash2, MessageCircle, CirclePlus, Asterisk } from "lucide-react";
import type { PropertyItemProps } from "../../utils/types";
import type { VisualProperty, FieldType } from "../../utils/schemaHelpers";
import { generateId } from "../../utils/schemaHelpers";

export const PropertyItem = ({
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
		const updated = (property.enum || []).filter((_: string, i: number) => i !== index);
		onUpdate({ ...property, enum: updated });
	};

	const handleNestedUpdate = (index: number, updatedProp: VisualProperty) => {
		const updated = [...(property.properties || [])];
		updated[index] = updatedProp;
		onUpdate({ ...property, properties: updated });
	};

	const handleNestedRemove = (index: number) => {
		const updated = (property.properties || []).filter(
			(_: VisualProperty, i: number) => i !== index,
		);
		onUpdate({ ...property, properties: updated });
	};

	const handleAddNestedItem = () => {
		const newProp: VisualProperty = {
			id: generateId(),
			name: "",
			type: "string",
			required: !!isStrict,
			isArray: false,
		};
		onUpdate({ ...property, properties: [...(property.properties || []), newProp] });
	};

	return (
		<div
			className="flex flex-col py-1"
			style={{ marginLeft: `${level * 24}px`, opacity: disabled ? 0.5 : 1 }}
		>
			<div className="flex items-center gap-3">
				<Input
					value={property.name}
					onChange={(e) => handleNameChange(e.target.value)}
					placeholder="Name"
					disabled={disabled}
					style={{ width: `${350 - level * 24}px` }}
					className="shrink-0"
				/>
				<Select
					onValueChange={handleTypeChange}
					value={property.type || undefined}
					disabled={disabled}
				>
					<SelectTrigger className="w-[200px]">
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
						<div key={`${property.id}-enum-${i}`} className="flex items-center gap-2">
							<Input
								value={val}
								onChange={(e) => handleEnumValueChange(i, e.target.value)}
								className="max-w-[322px]"
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
						className="text-blue-600 h-auto p-0 flex items-center justify-start gap-1 mt-2 -ml-1"
					>
						<CirclePlus className="w-4 h-4" /> Add value
					</Button>
				</div>
			)}

			{property.type === "object" && (
				<>
					{(property.properties || []).map((p: VisualProperty, i: number) => (
						<div key={p.id || `nested-${level}-${i}`} className="mt-4">
							<div
								className="text-[12px] mb-1"
								style={{ marginLeft: `${(level + 1) * 24}px` }}
							>
								Property
							</div>
							<PropertyItem
								property={p}
								level={level + 1}
								onUpdate={(updated) => handleNestedUpdate(i, updated)}
								onRemove={() => handleNestedRemove(i)}
								disabled={disabled}
								isStrict={isStrict}
							/>
						</div>
					))}
					<div className="ml-3 mt-2">
						<Button
							variant="link"
							onClick={handleAddNestedItem}
							className="text-blue-600 h-auto p-0 flex items-center justify-start gap-1 mt-2 -ml-1"
						>
							<CirclePlus className="w-4 h-4" /> Add nested property
						</Button>
					</div>
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
