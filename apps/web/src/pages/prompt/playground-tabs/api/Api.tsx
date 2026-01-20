"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClipboardText, Check } from "phosphor-react";
import { useApiEndpoint } from "./useApiEndpoint";

export default function ApiEndpoint() {
	const { promptId, apiUrl, copiedId, copiedURL, handleCopyId, handleCopyURL } =
		useApiEndpoint();

	return (
		<Card className="max-w-[1232px] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px] 2xl-plus:w-[70%] ml-3 mr-6 w-full my-8 shadow-none bg-card text-card-foreground">
			<div className="max-w-4xl">
				<CardHeader>
					<CardTitle className="text-xl text-foreground">API Endpoint</CardTitle>
				</CardHeader>

				<CardContent className="space-y-6 text-sm text-muted-foreground">
					{/* Prompt ID */}
					<section className="space-y-2">
						<Label className="text-foreground">Your Prompt ID</Label>
						<div className="relative w-full">
							<Input
								readOnly
								defaultValue={promptId}
								className="w-full py-7 pr-28 text-sm font-medium bg-muted cursor-default border border-border focus-visible:ring-0 focus-visible:ring-offset-0"
							/>
							<Button
								size="sm"
								disabled={copiedId}
								onClick={handleCopyId}
								className="absolute right-3 top-1/2 -translate-y-1/2"
							>
								{copiedId ? (
									<>
										<Check className="mr-2 h-4 w-4" />
										Copied
									</>
								) : (
									<>
										<ClipboardText className="mr-2 h-4 w-4" />
										Copy ID
									</>
								)}
							</Button>
						</div>
					</section>

					{/* URL */}
					<section className="space-y-2">
						<Label className="text-foreground">
							Use this URL to run your prompt via API. Replace{" "}
							<Badge variant="outline">YOUR_PROMPT_ID</Badge> with your actual prompt
							ID:
						</Label>
						<div className="relative w-full">
							<Input
								readOnly
								defaultValue={apiUrl}
								className="w-full py-7 pr-28 text-sm font-medium bg-muted cursor-default border border-border focus-visible:ring-0 focus-visible:ring-offset-0"
							/>
							<Button
								size="sm"
								disabled={copiedURL}
								onClick={handleCopyURL}
								className="absolute right-3 top-1/2 -translate-y-1/2"
							>
								{copiedURL ? (
									<>
										<Check className="mr-2 h-4 w-4" />
										Copied
									</>
								) : (
									<>
										<ClipboardText className="mr-2 h-4 w-4" />
										Copy URL
									</>
								)}
							</Button>
						</div>
					</section>

					{/* Method */}
					<section className="space-y-2">
						<Label className="text-foreground">
							Method: <span className="text-primary font-medium">POST</span>
						</Label>
					</section>

					{/* Headers */}
					<section className="space-y-2">
						<Label className="text-foreground">Headers:</Label>
						<pre className="rounded-md bg-muted p-4 text-xs leading-relaxed text-foreground border border-border overflow-x-auto">
							{`{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_API_KEY"
}`}
						</pre>
					</section>

					{/* Body */}
					<section className="space-y-2">
						<Label className="text-foreground">Request Body:</Label>
						<pre className="rounded-md bg-muted p-4 text-xs leading-relaxed text-foreground border border-border overflow-x-auto">
							{`{
  "id": YOUR_PROMPT_ID,               // Required: The ID of your prompt
  "question": "Your input text here", // Required: The text to process
  "memoryKey": "optional-memory-key", // Optional: Key for memory context
  "productive": boolean               // Optional: use committed prompt. Default is true
}`}
						</pre>
					</section>

					{/* Response */}
					<section className="space-y-2">
						<Label className="text-foreground">Response:</Label>
						<pre className="rounded-md bg-muted p-4 text-xs leading-relaxed text-foreground border border-border overflow-x-auto">
							{`{
  "answer": "Generated response",
  "tokens": {
    "prompt": 10,
    "completion": 20,
    "total": 30
  },
  "response_time_ms": 500,
  "chainOfThoughts": "Optional reasoning chain",
  "status": "Optional status (e.g. NOK: error message)"
}`}
						</pre>
					</section>

					{/* Error */}
					<section className="space-y-2">
						<Label className="text-foreground">Error Responses:</Label>
						<pre className="rounded-md bg-muted p-4 text-xs leading-relaxed text-foreground border border-border overflow-x-auto">
							{`{
  "error": "Error message"
}`}
						</pre>
					</section>
				</CardContent>
			</div>
		</Card>
	);
}
