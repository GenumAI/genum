import { describe, it, expect } from "vitest";
import { mapContentsToGeminiFormat } from "./utils";
import type { ProviderRequest } from "..";

function request(overrides: Partial<ProviderRequest> = {}): ProviderRequest {
	return {
		apikey: "key",
		instruction: "You are helpful",
		question: "Hello",
		model: "gemini-2.5-flash",
		parameters: {},
		promptPrice: 0.44,
		completionPrice: 1.32,
		...overrides,
	};
}

describe("mapContentsToGeminiFormat with no conversation", () => {
	it("is unchanged when no messages and no files are passed", () => {
		expect(mapContentsToGeminiFormat(request())).toEqual("Hello");
	});

	it("is unchanged when files are present but no messages are passed", () => {
		const files = [
			{
				id: "1",
				buffer: Buffer.from(""),
				contentType: "image/png",
				fileName: "a.png",
			},
		];

		expect(mapContentsToGeminiFormat(request({ files }))).toEqual([
			{ text: "Hello" },
			{ inlineData: { mimeType: "image/png", data: "" } },
		]);
	});
});
