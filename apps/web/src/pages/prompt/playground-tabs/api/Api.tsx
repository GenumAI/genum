"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardText, Check } from "@phosphor-icons/react";
import { promptAttributeSnippet } from "@/lib/otelSnippet";
import { useApiEndpoint } from "./hooks/useApiEndpoint";

const COPY_INPUT_CLASSNAME =
	"w-full py-7 pr-28 text-sm font-medium bg-muted cursor-default border border-border focus-visible:ring-0 focus-visible:ring-offset-0";

const PREVIEW_BLOCK_CLASSNAME =
	"max-w-full rounded-md border border-border bg-muted p-4 text-xs leading-relaxed text-foreground overflow-x-auto whitespace-pre-wrap break-words";

const HEADERS_EXAMPLE = `{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_API_KEY"
}`;

const REQUEST_BODY_EXAMPLE = `{
  "id": YOUR_PROMPT_ID,               // Required: The ID of your prompt
  "question": "Your input text here", // Required: The text to process
  "files": [                          // Optional: up to 3 files, total request max 50MB
    {
      "fileName": "invoice.pdf",
      "contentType": "application/pdf",
      "base64": "JVBERi0xLjQKJ..."      // Base64 content (raw or data URL)
    }
  ],
  "placeholders": {                   // Optional: one value NAME per placeholder key
    "tone": "formal"
  },
  "productive": boolean               // Optional: use committed prompt. Default is true
}`;

const RESPONSE_EXAMPLE = `{
  "answer": "Generated response",
  "tokens": {
    "prompt": 10,
    "completion": 20,
    "total": 30
  },
  "response_time_ms": 500,
  "chainOfThoughts": "Optional reasoning chain",
  "status": "Optional status (e.g. NOK: error message)",
  "placeholders": {
    "resolved": { "tone": "formal" },      // key -> the value name actually used
    "ignored": ["language"]                // keys you sent that were not applied: no such
                                           // {{key}} in the text, or no value by that name
  }
}`;

const ERROR_EXAMPLE = `{
  "error": "Error message"
}`;

const OTLP_SPAN_EXAMPLE = `{
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",  // one trace = one turn
  "spanId": "00f067aa0ba902b7",
  "name": "chat gpt-4o",
  "startTimeUnixNano": "1757500000000000000",
  "attributes": [
    { "key": "genum.prompt.id",        "value": { "intValue": "YOUR_PROMPT_ID" } },
    { "key": "gen_ai.operation.name",  "value": { "stringValue": "chat" } },
    { "key": "gen_ai.system",          "value": { "stringValue": "openai" } },
    { "key": "gen_ai.request.model",   "value": { "stringValue": "gpt-4o" } },
    { "key": "gen_ai.conversation.id", "value": { "stringValue": "conv-1" } },
    { "key": "gen_ai.usage.input_tokens",  "value": { "intValue": "120" } },
    { "key": "gen_ai.usage.output_tokens", "value": { "intValue": "34" } },

    // The conversation itself. Without these the turn is stored with an empty
    // answer, and a test case pinned from it asserts nothing.
    { "key": "gen_ai.input.messages",  "value": { "stringValue":
        "[{\"role\":\"user\",\"parts\":[{\"type\":\"text\",\"content\":\"weather in Kyiv?\"}]}]" } },
    { "key": "gen_ai.output.messages", "value": { "stringValue":
        "[{\"role\":\"assistant\",\"parts\":[{\"type\":\"text\",\"content\":\"21C and clear.\"}]}]" } }
  ]
}

// A tool call is a span of its own, and MUST say so in gen_ai.operation.name --
// that is what makes it a replayable step rather than just another answer:
{
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",   // the same turn
  "spanId": "00f067aa0ba902b8",
  "name": "execute_tool get_weather",
  "attributes": [
    { "key": "genum.prompt.id",            "value": { "intValue": "YOUR_PROMPT_ID" } },
    { "key": "gen_ai.operation.name",      "value": { "stringValue": "execute_tool" } },
    { "key": "gen_ai.tool.name",           "value": { "stringValue": "get_weather" } },
    { "key": "gen_ai.tool.call.arguments", "value": { "stringValue": "{\"city\":\"Kyiv\"}" } },
    { "key": "gen_ai.tool.call.result",    "value": { "stringValue": "{\"c\":21}" } }
  ]
}`;

const OTLP_RESPONSE_EXAMPLE = `// Everything stored:
{ "partialSuccess": {} }

// Some spans could not be stored -- the rest DID land, so do not resend the batch:
{
  "partialSuccess": {
    "rejectedSpans": "1",
    "errorMessage": "span 00f0.. has no genum.prompt.id and the API key has no default prompt"
  }
}

// Nothing in the batch could be stored (400), or the write failed on our side (503,
// safe to retry -- redelivering the same spans never duplicates them):
{ "status": "error", "statusCode": 400, "message": "No span could be stored. ..." }`;

type CopyFieldProps = {
	label?: string;
	value: string;
	buttonLabel: string;
	copied: boolean;
	onCopy: () => void;
	disabled?: boolean;
};

function ReadOnlyCopyField({
	label,
	value,
	buttonLabel,
	copied,
	onCopy,
	disabled,
}: CopyFieldProps) {
	return (
		<div className="space-y-2">
			{label ? <Label className="text-foreground">{label}</Label> : null}
			<div className="relative w-full">
				<Input readOnly value={value} spellCheck={false} className={COPY_INPUT_CLASSNAME} />
				<Button
					size="sm"
					disabled={disabled || copied}
					onClick={onCopy}
					className="absolute right-3 top-1/2 -translate-y-1/2"
				>
					{copied ? (
						<>
							<Check className="mr-2 h-4 w-4" />
							Copied
						</>
					) : (
						<>
							<ClipboardText className="mr-2 h-4 w-4" />
							{buttonLabel}
						</>
					)}
				</Button>
			</div>
		</div>
	);
}

type JsonSectionProps = {
	title: string;
	content: string;
	action?: React.ReactNode;
};

function JsonSection({ title, content, action }: JsonSectionProps) {
	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between gap-2">
				<Label className="text-foreground">{title}</Label>
				{action}
			</div>
			<pre className={PREVIEW_BLOCK_CLASSNAME}>{content}</pre>
		</div>
	);
}

export default function ApiEndpoint() {
	const {
		promptId,
		apiUrl,
		otelUrl,
		otelPostUrl,
		otelEnv,
		copiedId,
		copiedURL,
		copiedOtelURL,
		copiedOtelEnv,
		handleCopyId,
		handleCopyURL,
		handleCopyOtelURL,
		handleCopyOtelEnv,
	} = useApiEndpoint();
	const promptIdValue = promptId?.toString() ?? "";

	return (
		<div className="w-full min-w-0 px-3 pt-8 lg:pr-6">
			<Card className="w-full min-w-0 overflow-hidden bg-card text-card-foreground shadow-none">
				<div className="w-full min-w-0">
					<CardHeader>
						<CardTitle className="text-xl text-foreground">API Endpoint</CardTitle>
					</CardHeader>

					<CardContent className="space-y-6 text-sm text-muted-foreground">
						<ReadOnlyCopyField
							label="Your Prompt ID"
							value={promptIdValue}
							buttonLabel="Copy ID"
							copied={copiedId}
							onCopy={handleCopyId}
							disabled={!promptIdValue}
						/>

						{/*
						 * Two ways in, and they are not variants of one endpoint: the first
						 * RUNS this prompt for you, the second RECEIVES an agent you run
						 * yourself. Choosing wrongly is a wasted afternoon, so they are
						 * named for the job rather than for the protocol.
						 */}
						<Tabs defaultValue="automation" className="w-full min-w-0">
							<TabsList>
								<TabsTrigger value="automation">Prompt Automation</TabsTrigger>
								<TabsTrigger value="agentic">Agentic</TabsTrigger>
							</TabsList>

							<TabsContent value="automation" className="space-y-6 pt-4">
								<p>
									Run this prompt from your own code. Genum calls the model,
									records the run, and returns the answer.
								</p>

								<section className="space-y-2">
									<Label className="text-foreground">
										Use this URL to run your prompt via API. Replace{" "}
										<Badge variant="outline">YOUR_PROMPT_ID</Badge> with your
										actual prompt ID:
									</Label>
									<ReadOnlyCopyField
										label=""
										value={apiUrl}
										buttonLabel="Copy URL"
										copied={copiedURL}
										onCopy={handleCopyURL}
									/>
								</section>

								<section className="space-y-2">
									<Label className="text-foreground">
										Method:{" "}
										<span className="text-primary font-medium">POST</span>
									</Label>
								</section>

								<JsonSection title="Headers:" content={HEADERS_EXAMPLE} />
								<JsonSection title="Request Body:" content={REQUEST_BODY_EXAMPLE} />
								<JsonSection title="Response:" content={RESPONSE_EXAMPLE} />
								<JsonSection title="Error Responses:" content={ERROR_EXAMPLE} />
							</TabsContent>

							<TabsContent value="agentic" className="space-y-6 pt-4">
								<p>
									Send traces from an agent you run yourself, over{" "}
									<span className="text-foreground font-medium">
										OpenTelemetry
									</span>
									. Each trace becomes a session you can read in Logs and pin as a
									test case — no Genum-specific code in your agent.
								</p>

								<section className="space-y-2">
									<Label className="text-foreground">
										Exporter endpoint — the base, without{" "}
										<Badge variant="outline">/v1/traces</Badge>. Your exporter
										appends that itself:
									</Label>
									<ReadOnlyCopyField
										label=""
										value={otelUrl}
										buttonLabel="Copy URL"
										copied={copiedOtelURL}
										onCopy={handleCopyOtelURL}
									/>
								</section>

								<JsonSection
									title="Exporter configuration:"
									content={otelEnv}
									action={
										<Button
											size="sm"
											variant="outline"
											disabled={copiedOtelEnv}
											onClick={handleCopyOtelEnv}
										>
											{copiedOtelEnv ? (
												<>
													<Check className="mr-2 h-4 w-4" />
													Copied
												</>
											) : (
												<>
													<ClipboardText className="mr-2 h-4 w-4" />
													Copy
												</>
											)}
										</Button>
									}
								/>

								<section className="space-y-2">
									<Label className="text-foreground">
										Two things your agent must set:
									</Label>
									<ul className="list-disc space-y-2 pl-5">
										<li>
											<Badge variant="outline">genum.prompt.id</Badge> on{" "}
											<span className="text-foreground font-medium">
												every span
											</span>
											— this is the only thing that ties a span to this
											prompt. It is never guessed from your API key or service
											name, and a span without it is rejected. Per span rather
											than per request, because a collector merges spans from
											several services into one batch.
										</li>
										<li>
											<Badge variant="outline">http/json</Badge> as the
											protocol. OTLP protobuf is not accepted yet.
										</li>
									</ul>
								</section>

								<JsonSection
									title="In your instrumentation:"
									content={promptAttributeSnippet(promptId)}
								/>

								<section className="space-y-2">
									<Label className="text-foreground">
										How your traces are read:
									</Label>
									<ul className="list-disc space-y-2 pl-5">
										<li>
											One trace is one{" "}
											<span className="text-foreground font-medium">
												turn
											</span>
											. Spans are ordered by start time within it.
										</li>
										<li>
											The answer comes from{" "}
											<Badge variant="outline">gen_ai.output.messages</Badge>,
											and a tool call from{" "}
											<Badge variant="outline">
												gen_ai.tool.call.arguments
											</Badge>{" "}
											and{" "}
											<Badge variant="outline">gen_ai.tool.call.result</Badge>{" "}
											on a span whose operation is{" "}
											<Badge variant="outline">execute_tool</Badge>. Omit them
											and the turn is stored with an empty answer and no
											replayable tool call.
										</li>
										<li>
											<Badge variant="outline">gen_ai.conversation.id</Badge>{" "}
											groups turns into one session. Without it, each trace is
											a session of a single turn.
										</li>
										<li>
											From the second turn on, the last{" "}
											<Badge variant="outline">user</Badge> entry of{" "}
											<Badge variant="outline">gen_ai.input.messages</Badge>{" "}
											becomes the human reply that provoked that turn.
										</li>
										<li>
											Usage from your spans is displayed but never billed or
											added to your Genum totals — ingested traces cost
											nothing.
										</li>
										<li>
											Redelivering a batch is safe: a span that arrives twice
											is stored once as far as every read is concerned.
										</li>
									</ul>
								</section>

								<section className="space-y-2">
									<Label className="text-foreground">
										Posting OTLP JSON directly (
										<span className="text-primary font-medium">POST</span>{" "}
										{otelPostUrl}):
									</Label>
									<JsonSection title="One span:" content={OTLP_SPAN_EXAMPLE} />
								</section>

								<JsonSection title="Response:" content={OTLP_RESPONSE_EXAMPLE} />
							</TabsContent>
						</Tabs>
					</CardContent>
				</div>
			</Card>
		</div>
	);
}
