import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { detectPlaceholderKeys } from "@genum/placeholders";
import { useShallow } from "zustand/react/shallow";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getOrgId, getProjectId } from "@/api/client";
import { usePromptPlaceholders } from "@/pages/prompt/playground-tabs/placeholders/hooks/usePromptPlaceholders";
import usePlaygroundStore from "@/stores/playground.store";
import type { PromptPlaceholder } from "@/api/prompt/placeholder.api";

const MAX_VISIBLE_CHIPS = 6;

interface PlaceholderChipsProps {
	promptId: number | undefined;
	text: string;
}

function effectiveValueLabel(
	definition: PromptPlaceholder | undefined,
	selectedValueName: string | undefined,
) {
	if (selectedValueName) {
		return { label: selectedValueName, muted: false };
	}

	const defaultValue = definition?.values.find((value) => value.isDefault);
	if (defaultValue) {
		return { label: defaultValue.name, muted: true };
	}

	return { label: "—", muted: true };
}

function DefinedPlaceholderChip({
	definition,
	selectedValueName,
	onSelect,
	onClear,
}: {
	definition: PromptPlaceholder;
	selectedValueName: string | undefined;
	onSelect: (valueName: string) => void;
	onClear: () => void;
}) {
	const { label, muted } = effectiveValueLabel(definition, selectedValueName);

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-3 py-1 text-xs transition-colors hover:bg-muted/60"
				>
					<span className="font-semibold text-foreground">{definition.key}</span>
					<span
						className={cn(
							"truncate",
							muted ? "text-muted-foreground" : "text-foreground",
						)}
					>
						{label}
					</span>
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-64 p-2" align="start">
				<div className="mb-2 px-1 text-xs font-semibold text-foreground">
					{definition.key}
				</div>
				<div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
					{definition.values.length === 0 && (
						<p className="px-1 py-1 text-xs text-muted-foreground">
							No values defined yet.
						</p>
					)}
					{definition.values.map((value) => {
						const isSelected = value.name === selectedValueName;
						return (
							<button
								key={value.id}
								type="button"
								onClick={() => (isSelected ? onClear() : onSelect(value.name))}
								className={cn(
									"flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/60",
									isSelected && "bg-muted/60",
								)}
							>
								<span className="flex min-w-0 items-center gap-1.5">
									<span className="truncate text-foreground">{value.name}</span>
									{value.isDefault && (
										<span className="shrink-0 text-[10px] text-muted-foreground">
											default
										</span>
									)}
								</span>
								{isSelected && (
									<CheckIcon
										className="h-3.5 w-3.5 shrink-0 text-primary"
										weight="bold"
									/>
								)}
							</button>
						);
					})}
				</div>
			</PopoverContent>
		</Popover>
	);
}

function UndefinedPlaceholderChip({
	placeholderKey,
	onClick,
}: {
	placeholderKey: string;
	onClick: () => void;
}) {
	return (
		<button type="button" onClick={onClick} className="inline-flex rounded-full">
			<Badge variant="destructive" className="cursor-pointer gap-1 rounded-full">
				<WarningCircleIcon className="h-3.5 w-3.5" weight="fill" />
				{placeholderKey} — not defined
			</Badge>
		</button>
	);
}

export default function PlaceholderChips({ promptId, text }: PlaceholderChipsProps) {
	const navigate = useNavigate();
	const [isExpanded, setIsExpanded] = useState(false);

	const keys = useMemo(() => detectPlaceholderKeys(text), [text]);
	const { data: placeholders = [] } = usePromptPlaceholders(promptId, keys.length > 0);

	const { selectedPlaceholders, setPlaceholderSelection, clearPlaceholderSelection } =
		usePlaygroundStore(
			useShallow((state) => ({
				selectedPlaceholders: state.selectedPlaceholders,
				setPlaceholderSelection: state.setPlaceholderSelection,
				clearPlaceholderSelection: state.clearPlaceholderSelection,
			})),
		);

	const definitionsByKey = useMemo(() => {
		const map = new Map<string, PromptPlaceholder>();
		for (const definition of placeholders) {
			map.set(definition.key, definition);
		}
		return map;
	}, [placeholders]);

	if (keys.length === 0) {
		return null;
	}

	const visibleKeys = isExpanded ? keys : keys.slice(0, MAX_VISIBLE_CHIPS);
	const hiddenCount = keys.length - visibleKeys.length;

	const goToPlaceholdersTab = () => {
		if (!promptId) return;
		const orgId = getOrgId();
		const projectId = getProjectId();
		const workspacePrefix = [orgId, projectId].filter(Boolean).join("/");
		const path = workspacePrefix
			? `/${workspacePrefix}/prompt/${promptId}/placeholders`
			: `/prompt/${promptId}/placeholders`;
		navigate(path);
	};

	return (
		<div className="flex flex-wrap items-center gap-1.5">
			{visibleKeys.map((key) => {
				const definition = definitionsByKey.get(key);
				if (!definition) {
					return (
						<UndefinedPlaceholderChip
							key={key}
							placeholderKey={key}
							onClick={goToPlaceholdersTab}
						/>
					);
				}

				// The store's selection map is a flat, unscoped Record<key, valueName> that
				// persists across prompts and is never invalidated when a definition's
				// values change. A stale name (from another prompt, or a value that was
				// since renamed/removed) must not read as "selected" — that would show an
				// active, unmuted chip for a value the run will silently fail to resolve
				// and fall back from. Validating against the live definition here is the
				// one place this gets decided, so the popover's checkmark and the run body
				// agree with what the chip displays.
				const rawSelection = selectedPlaceholders[key];
				const selectedValueName = definition.values.some(
					(value) => value.name === rawSelection,
				)
					? rawSelection
					: undefined;

				return (
					<DefinedPlaceholderChip
						key={key}
						definition={definition}
						selectedValueName={selectedValueName}
						onSelect={(valueName) => setPlaceholderSelection(key, valueName)}
						onClear={() => clearPlaceholderSelection(key)}
					/>
				);
			})}
			{hiddenCount > 0 && (
				<button
					type="button"
					onClick={() => setIsExpanded(true)}
					className="inline-flex items-center rounded-full border border-border bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60"
				>
					+{hiddenCount}
				</button>
			)}
		</div>
	);
}
