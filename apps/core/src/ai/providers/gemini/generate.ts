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

	const usage = response.usageMetadata;
	const reasoning = usage?.thoughtsTokenCount ?? 0;
	// Gemini reports thoughts beside candidatesTokenCount and tool-use input beside
	// promptTokenCount; totalTokenCount is the sum of all four.
	const prompt = (usage?.promptTokenCount ?? 0) + (usage?.toolUsePromptTokenCount ?? 0);
	const completion = (usage?.candidatesTokenCount ?? 0) + reasoning;

	const result: ProviderResponse = {
		answer: answer,
		toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
		tokens: {
			prompt,
			completion,
			total: usage?.totalTokenCount ?? prompt + completion,
			cacheRead: usage?.cachedContentTokenCount ?? 0,
			// Implicit caching has no write fee; explicit caches are billed as storage.
			cacheWrite: 0,
			reasoning,
		},
		response_time_ms: Date.now() - start,
	};

	return result;
}
