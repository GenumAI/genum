import { GoogleGenAI } from "@google/genai";
import type { ProviderRequest, ProviderResponse } from "..";
import { mapConfigToGemini, mapContentsToGeminiFormat } from "./utils";

export async function generateGemini(request: ProviderRequest) {
	const start = Date.now();

	const ai = new GoogleGenAI({ apiKey: request.apikey });

	const response = await ai.models.generateContent({
		model: request.model,
		config: mapConfigToGemini(request),
		contents: mapContentsToGeminiFormat(request),
	});

	console.log(JSON.stringify(response, null, 2));

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

	const result: ProviderResponse = {
		answer: answer,
		tokens: {
			prompt: response.usageMetadata?.promptTokenCount ?? 0,
			completion: response.usageMetadata?.candidatesTokenCount ?? 0,
			total: response.usageMetadata?.totalTokenCount ?? 0,
		},
		response_time_ms: Date.now() - start,
	};

	return result;
}
