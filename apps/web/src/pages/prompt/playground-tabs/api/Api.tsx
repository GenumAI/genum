"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClipboardText, Check } from "phosphor-react";
import { useApiEndpoint } from "./hooks/useApiEndpoint";

const COPY_INPUT_CLASSNAME =
	"w-full py-7 pr-28 text-sm font-medium bg-muted cursor-default border border-border focus-visible:ring-0 focus-visible:ring-offset-0";

const PREVIEW_BLOCK_CLASSNAME =
	"rounded-md bg-muted p-4 text-xs leading-relaxed text-foreground border border-border overflow-x-auto";

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
  "memoryKey": "optional-memory-key", // Optional: Key for memory context
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
  "status": "Optional status (e.g. NOK: error message)"
}`;

const ERROR_EXAMPLE = `{
  "error": "Error message"
}`;

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
				<Input
					readOnly
					value={value}
					spellCheck={false}
					className={COPY_INPUT_CLASSNAME}
				/>
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
};

function JsonSection({ title, content }: JsonSectionProps) {
	return (
		<div className="space-y-2">
			<Label className="text-foreground">{title}</Label>
			<pre className={PREVIEW_BLOCK_CLASSNAME}>{content}</pre>
		</div>
	);
}

export default function ApiEndpoint() {
	const { promptId, apiUrl, copiedId, copiedURL, handleCopyId, handleCopyURL } =
		useApiEndpoint();
	const promptIdValue = promptId?.toString() ?? "";

	return (
		<Card className="max-w-[1232px] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px] 2xl-plus:w-[70%] ml-3 mr-6 w-full my-8 shadow-none bg-card text-card-foreground">
			<div className="max-w-4xl">
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

					<section className="space-y-2">
						<Label className="text-foreground">
							Use this URL to run your prompt via API. Replace{" "}
							<Badge variant="outline">YOUR_PROMPT_ID</Badge> with your actual prompt
							ID:
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
							Method: <span className="text-primary font-medium">POST</span>
						</Label>
					</section>

					<JsonSection title="Headers:" content={HEADERS_EXAMPLE} />
					<JsonSection title="Request Body:" content={REQUEST_BODY_EXAMPLE} />
					<JsonSection title="Response:" content={RESPONSE_EXAMPLE} />
					<JsonSection title="Error Responses:" content={ERROR_EXAMPLE} />
				</CardContent>
			</div>
		</Card>
	);
}
