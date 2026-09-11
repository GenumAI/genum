import { GoogleGenAI } from "@google/genai";
import type { ProviderRequest, ProviderResponse, ToolCall } from "..";
import { mapConfigToGemini, mapContentsToGeminiFormat } from "./utils";

export async function generateGemini(request: ProviderRequest) {
	const start = Date.now();

	const ai = new GoogleGenAI({ apiKey: request.apikey });

	const response = await ai.models.generateContent({
		model: request.model,
		config: mapConfigToGemini(request),
		contents: mapContentsToGeminiFormat(request),
	});

	let answer = "";

	if (response.candidates?.[0]?.content?.parts) {
		const lastPart =
			response.candidates[0].content.parts[response.candidates[0].content.parts.length - 1];

		if (lastPart?.text) {
			answer = lastPart.text;
		} else if (lastPart?.functionCall) {
			answer = JSON.stringify(lastPart.functionCall);
		}
	}

	const parts = response.candidates?.[0]?.content?.parts ?? [];
	const toolCalls: ToolCall[] = parts
		.map((part, index) => ({ part, index }))
		.filter(({ part }) => part.functionCall)
		.map(({ part, index }) => ({
			// Gemini does not return a call id; the part's position is the only stable
			// handle, and it is what the tool result must be correlated back to.
			id: part.functionCall?.id ?? `gemini-${index}`,
			name: part.functionCall?.name ?? "",
			args: (part.functionCall?.args ?? {}) as Record<string, unknown>,
		}));

	const result: ProviderResponse = {
		answer: answer,
		toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
		tokens: {
			prompt: response.usageMetadata?.promptTokenCount ?? 0,
			completion: response.usageMetadata?.candidatesTokenCount ?? 0,
			total: response.usageMetadata?.totalTokenCount ?? 0,
		},
		response_time_ms: Date.now() - start,
	};

	return result;
}
