import { describe, it, expect } from "vitest";
import { inputMapper } from "./utils";
import type { ProviderRequest } from "..";

function request(overrides: Partial<ProviderRequest> = {}): ProviderRequest {
	return {
		apikey: "key",
		instruction: "You are helpful",
		question: "Hello",
		model: "gpt-5",
		parameters: {},
		promptPrice: 0.44,
		completionPrice: 1.32,
		...overrides,
	};
}

describe("inputMapper with no conversation", () => {
	it("returns the bare question string when there are no messages and no files", () => {
		expect(inputMapper(request())).toBe("Hello");
	});

	it("returns the unchanged one-element array when files are present but no messages", () => {
		const files = [
			{
				id: "1",
				buffer: Buffer.from(""),
				contentType: "image/png",
				fileName: "a.png",
			},
		];

		expect(inputMapper(request({ files }))).toEqual([
			{
				role: "user",
				content: [
					{ type: "input_text", text: "Hello" },
					{
						type: "input_image",
						image_url: "data:image/png;base64,",
						detail: "auto",
					},
				],
			},
		]);
	});
});
