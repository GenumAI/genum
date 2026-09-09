import { useEffect, useId, useRef, useState } from "react";

import { CaretRight, ChatText, Wrench } from "@phosphor-icons/react";

import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ArgsMatch, Step } from "@/types/steps";

export interface StepRowProps {
	step: Step;
	/**
	 * Recorded arguments that could not be parsed were degraded to `{}` with
	 * `argsMatch: "ignore"`. Without saying so, that renders identically to a tool
	 * genuinely called with no arguments.
	 */
	unreadableArgs?: boolean;
	/**
	 * The last run's outcome for this step. Absent means "no run to report".
	 * `"not-asserted"` is a step the author excluded from comparison; `"not-reached"` is
	 * a step the session never got to. Both render muted, but they are different facts
	 * about the run and must not collapse into one label.
	 */
	outcome?: "matched" | "mismatched" | "not-asserted" | "not-reached";
	/** Why it mismatched, from `StepMismatch.reason`. */
	outcomeReason?: string;
	/**
	 * This row records something that happened and cannot be edited at all — a log's
	 * recorded trace. The checkbox and matcher select are absent from the DOM entirely
	 * (not merely disabled). Distinct from `disabled`, which is a live control
	 * momentarily unavailable: conflating the two makes a permanent state and a
	 * transient one indistinguishable to the reader.
	 */
	readOnly?: boolean;
	/** A write is in flight; the control is temporarily unavailable. */
	disabled?: boolean;
	onEnabledChange?: (enabled: boolean) => void;
	onArgsMatchChange?: (argsMatch: ArgsMatch) => void;
	/**
	 * Committed on blur, for a `final` step's editable text. Returning (or resolving to)
	 * `false` means the commit was not accepted -- a save already in flight elsewhere,
	 * say -- and the field must keep its draft and stay dirty rather than silently
	 * dropping the author's edit. `true` or `undefined` (a callback with no return
	 * statement included) counts as accepted; a rejected `Promise` counts as not accepted,
	 * the same as a resolved `false`.
	 */
	onTextChange?: (text: string) => boolean | undefined | Promise<boolean | undefined>;
}

const OUTCOME_LABEL: Record<NonNullable<StepRowProps["outcome"]>, string> = {
	matched: "matched",
	mismatched: "did not match",
	"not-asserted": "not checked",
	"not-reached": "not reached",
};

/** `key: value` pairs joined by commas, for the tool call's collapsed one-liner. */
function summarizeArgs(args: Record<string, unknown> | undefined): string {
	const entries = Object.entries(args ?? {});
	if (entries.length === 0) return "no arguments";
	return entries.map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(", ");
}

/**
 * A `final` step's text, editable when `readOnly` is false. Local state buffers
 * keystrokes and commits on blur -- every turn's final answer is compared, so every one
 * needs to be editable, not just a single "the" expected output.
 */
function EditableFinalText({
	text,
	readOnly,
	disabled,
	onTextChange,
}: {
	text: string;
	readOnly: boolean;
	disabled: boolean;
	onTextChange?: (text: string) => boolean | undefined | Promise<boolean | undefined>;
}) {
	const [draft, setDraft] = useState(text);
	// Whether the author has typed since the last resync/commit. This, not focus, is
	// what gates the resync below: being present in a field is not the same as having
	// edited it, and a field can sit focused-but-untouched while a prop update arrives
	// (tab into it, look, tab out) -- gating on focus alone made that sequence commit the
	// stale `draft` back over the newer `text` on blur, reverting it. A ref, not state:
	// nothing here needs to trigger a render on its own.
	const dirty = useRef(false);

	// The row is keyed by kind+index, not by content, so a step that keeps its position
	// but gets new text from underneath (a refetch, a different trajectory) would
	// otherwise leave stale text in the box -- EXCEPT while the author has unsaved
	// keystrokes in it. Accepting the incoming `text` there would silently overwrite
	// those keystrokes -- loss of work, not mere staleness.
	useEffect(() => {
		if (!dirty.current) {
			setDraft(text);
		}
	}, [text]);

	if (readOnly) {
		return <div className="whitespace-pre-wrap text-sm">{text}</div>;
	}

	return (
		<Textarea
			className="mt-1 text-sm"
			value={draft}
			disabled={disabled}
			onChange={(event) => {
				dirty.current = true;
				setDraft(event.target.value);
			}}
			onBlur={() => {
				// Every commit sends the whole `expectedSteps` array and the panel
				// freezes its controls while it's in flight -- firing when the author
				// never actually typed (tabbed through, focused then blurred untouched)
				// would cost them that freeze for a write with no effect. `dirty` is the
				// authority here, not a `draft !== text` comparison alone: without it, a
				// field that sat focused-but-untouched while a newer `text` arrived would
				// still hold the old value and would commit it over the new one.
				if (!(dirty.current && draft !== text)) return;
				// Disabling the focused control -- a save elsewhere flips `disabled` while
				// this field still has focus -- blurs it, landing here. `dirty` must
				// survive that unless the commit actually lands: clearing it unconditionally
				// let the resync effect above accept the next `text` prop and silently
				// overwrite a draft that was never saved. `Promise.resolve` normalizes the
				// sync (guard-rejected) and async (network-rejected) cases onto one path;
				// only an explicit `false` means "not accepted". `setStepText` catches its
				// own rejections today, so `.catch` here is currently unreachable -- but the
				// prop type permits any `Promise`, and a future caller that lets one reject
				// must not turn into an unhandled rejection. A rejection is exactly a
				// not-accepted commit, so it does nothing: `dirty` was never cleared for it.
				Promise.resolve(onTextChange?.(draft))
					.then((committed) => {
						if (committed !== false) dirty.current = false;
					})
					.catch(() => {});
			}}
		/>
	);
}

export function StepRow({
	step,
	unreadableArgs = false,
	outcome,
	outcomeReason,
	readOnly = false,
	disabled = false,
	onEnabledChange,
	onArgsMatchChange,
	onTextChange,
}: StepRowProps) {
	// `enabled` is optional and absent means enabled -- the same rule the server's
	// comparison uses. Reading it as `=== true` would render a pinned step as unticked.
	const enabled = step.enabled !== false;
	// Collapsed by default: at five turns of tool calls, the pretty-printed args for
	// every one of them is a wall.
	const [expanded, setExpanded] = useState(false);
	const continuesSessionId = useId();

	return (
		<div className="flex items-start gap-3">
			{!readOnly && step.kind !== "user" && (
				<Checkbox
					className="mt-1"
					checked={enabled}
					disabled={disabled}
					onCheckedChange={(checked) => onEnabledChange?.(checked === true)}
				/>
			)}
			{step.kind === "tool_call" ? (
				<Wrench className="mt-1 shrink-0" size={16} />
			) : (
				<ChatText className="mt-1 shrink-0" size={16} />
			)}
			<div className="min-w-0 flex-1">
				{step.kind === "tool_call" ? (
					<>
						<Collapsible open={expanded} onOpenChange={setExpanded}>
							<CollapsibleTrigger asChild>
								<button
									type="button"
									className="flex w-full min-w-0 items-center gap-1 bg-transparent text-left"
								>
									<CaretRight
										className={cn(
											"shrink-0 text-muted-foreground transition-transform",
											expanded && "rotate-90",
										)}
										size={12}
									/>
									<span className="truncate text-sm">
										<span className="font-medium">{step.name}</span> ·{" "}
										{summarizeArgs(step.args)}
									</span>
								</button>
							</CollapsibleTrigger>
							<CollapsibleContent>
								<pre className="mt-1 overflow-x-auto font-mono text-xs">
									{JSON.stringify(step.args ?? {}, null, 2)}
								</pre>
								{step.recordedResult !== undefined && (
									<>
										<div className="mt-2 text-xs font-medium text-muted-foreground">
											Result
										</div>
										<pre className="mt-1 overflow-x-auto font-mono text-xs">
											{step.recordedResult}
										</pre>
									</>
								)}
							</CollapsibleContent>
						</Collapsible>
						{unreadableArgs && (
							<p className="mt-1 text-xs text-destructive">
								Recorded arguments could not be read -- shown as empty and ignored,
								not a genuine no-args call.
							</p>
						)}
						{!readOnly && (
							<Select
								value={step.argsMatch ?? "exact"}
								disabled={disabled}
								onValueChange={(value) => onArgsMatchChange?.(value as ArgsMatch)}
							>
								<SelectTrigger className="mt-1 w-64">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="exact">
										Arguments must match exactly
									</SelectItem>
									<SelectItem value="subset">
										Only these keys must match
									</SelectItem>
									<SelectItem value="ignore">Ignore arguments</SelectItem>
								</SelectContent>
							</Select>
						)}
					</>
				) : step.kind === "final" ? (
					<>
						<div className="font-medium text-sm">Turn's answer</div>
						<EditableFinalText
							text={step.text}
							readOnly={readOnly}
							disabled={disabled}
							onTextChange={onTextChange}
						/>
					</>
				) : (
					<>
						{/*
						 * Named the way a `final` row is named. Without it the reply is a
						 * bare paragraph carrying a checkbox, and the control's subject --
						 * whose words these are, and what unticking them does -- is left to
						 * the reader to infer from the text itself.
						 */}
						<div className="font-medium text-sm">Your reply</div>
						<div className="whitespace-pre-wrap text-sm">{step.text}</div>
						{!readOnly && (
							// This checkbox does not mean the same thing here as it does on a
							// tool call: unticking a reply cannot merely exclude it from
							// comparison (a reply is never compared), it ends the session at
							// this turn. A bare tick would leave that meaning to guesswork.
							//
							// The words state what the TICK means, not what unticking does:
							// `checked` is "the session continues", so a label reading "ends
							// the session here" sat beside a ticked box invited exactly the
							// backwards inference the label exists to prevent. This reading
							// stays true in both states -- ticked, the session continues past
							// the reply; unticked, it does not.
							<label
								htmlFor={continuesSessionId}
								className="mt-1 flex w-fit items-center gap-2 text-xs text-muted-foreground"
							>
								<Checkbox
									id={continuesSessionId}
									checked={enabled}
									disabled={disabled}
									onCheckedChange={(checked) =>
										onEnabledChange?.(checked === true)
									}
								/>
								the session continues after this reply
							</label>
						)}
					</>
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
