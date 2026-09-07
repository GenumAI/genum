import { ChatText, Wrench } from "@phosphor-icons/react";

import { Checkbox } from "@/components/ui/checkbox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { ArgsMatch, Step } from "@/types/steps";

export interface StepRowProps {
	step: Step;
	/**
	 * Recorded arguments that could not be parsed were degraded to `{}` with
	 * `argsMatch: "ignore"`. Without saying so, that renders identically to a tool
	 * genuinely called with no arguments.
	 */
	unreadableArgs?: boolean;
	/** The last run's outcome for this step. Absent means "no run to report". */
	outcome?: "matched" | "mismatched" | "not-asserted";
	/** Why it mismatched, from `StepMismatch.reason`. */
	outcomeReason?: string;
	/**
	 * This row records something that happened and cannot be edited at all — a log's
	 * recorded trace. Distinct from `disabled`, which is a live control momentarily
	 * unavailable: conflating the two makes a permanent state and a transient one
	 * indistinguishable to the reader.
	 */
	readOnly?: boolean;
	/** A write is in flight; the control is temporarily unavailable. */
	disabled?: boolean;
	onEnabledChange?: (enabled: boolean) => void;
	onArgsMatchChange?: (argsMatch: ArgsMatch) => void;
}

const OUTCOME_LABEL: Record<NonNullable<StepRowProps["outcome"]>, string> = {
	matched: "matched",
	mismatched: "did not match",
	"not-asserted": "not checked",
};

export function StepRow({
	step,
	unreadableArgs = false,
	outcome,
	outcomeReason,
	readOnly = false,
	disabled = false,
	onEnabledChange,
	onArgsMatchChange,
}: StepRowProps) {
	// `enabled` is optional and absent means enabled -- the same rule the server's
	// comparison uses. Reading it as `=== true` would render a pinned step as unticked.
	const enabled = step.enabled !== false;
	const inert = readOnly || disabled;

	return (
		<div className="flex items-start gap-3">
			<Checkbox
				className="mt-1"
				checked={enabled}
				disabled={inert}
				onCheckedChange={(checked) => onEnabledChange?.(checked === true)}
			/>
			{step.kind === "tool_call" ? (
				<Wrench className="mt-1 shrink-0" size={16} />
			) : (
				<ChatText className="mt-1 shrink-0" size={16} />
			)}
			<div className="min-w-0 flex-1">
				{step.kind === "tool_call" ? (
					<>
						<div className="font-medium">{step.name}</div>
						<pre className="mt-1 overflow-x-auto text-xs">
							{JSON.stringify(step.args ?? {}, null, 2)}
						</pre>
						{unreadableArgs && (
							<p className="mt-1 text-xs text-destructive">
								Recorded arguments could not be read -- shown as empty and ignored,
								not a genuine no-args call.
							</p>
						)}
						<Select
							value={step.argsMatch ?? "exact"}
							disabled={inert}
							onValueChange={(value) => onArgsMatchChange?.(value as ArgsMatch)}
						>
							<SelectTrigger className="mt-1 w-64">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="exact">Arguments must match exactly</SelectItem>
								<SelectItem value="subset">Only these keys must match</SelectItem>
								<SelectItem value="ignore">Ignore arguments</SelectItem>
							</SelectContent>
						</Select>
					</>
				) : (
					<div className="whitespace-pre-wrap">{step.text}</div>
				)}
				{outcome && (
					<p
						className={
							outcome === "mismatched"
								? "mt-1 text-xs text-destructive"
								: "mt-1 text-xs text-muted-foreground"
						}
					>
						{OUTCOME_LABEL[outcome]}
						{outcome === "mismatched" && outcomeReason ? `: ${outcomeReason}` : ""}
					</p>
				)}
			</div>
		</div>
	);
}
