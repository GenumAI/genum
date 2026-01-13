import { describe, it, expect, beforeEach } from "vitest";
import { ModelConfigService } from "./modelConfigService";
import { AiVendor } from "@/prisma";
import type { ModelConfigParameters } from "./types";

describe("ModelConfigService", () => {
	let service: ModelConfigService;

	beforeEach(() => {
		service = new ModelConfigService();
	});

	describe("getModelConfig", () => {
		it("should return model config for existing model", () => {
			const config = service.getModelConfig("gpt-4o", AiVendor.OPENAI);
			expect(config).toBeDefined();
			expect(config?.name).toBe("gpt-4o");
			expect(config?.vendor).toBe("OPENAI");
			expect(config?.parameters).toBeDefined();
		});

		it("should return undefined for non-existent model", () => {
			const config = service.getModelConfig("non-existent-model", AiVendor.OPENAI);
			expect(config).toBeUndefined();
		});

		it("should return undefined for wrong vendor", () => {
			const config = service.getModelConfig("gpt-4o", AiVendor.ANTHROPIC);
			expect(config).toBeUndefined();
		});

		it("should find models from different vendors", () => {
			const openaiConfig = service.getModelConfig("gpt-4o", AiVendor.OPENAI);
			const anthropicConfig = service.getModelConfig(
				"claude-3-7-sonnet-latest",
				AiVendor.ANTHROPIC,
			);
			const googleConfig = service.getModelConfig("gemini-2.0-flash", AiVendor.GOOGLE);

			expect(openaiConfig).toBeDefined();
			expect(openaiConfig?.vendor).toBe("OPENAI");

			expect(anthropicConfig).toBeDefined();
			expect(anthropicConfig?.vendor).toBe("ANTHROPIC");

			expect(googleConfig).toBeDefined();
			expect(googleConfig?.vendor).toBe("GOOGLE");
		});
	});

	describe("getLLMConfig", () => {
		it("should return model config for existing model", () => {
			const config = service.getLLMConfig("gpt-4o", AiVendor.OPENAI);
			expect(config).toBeDefined();
			expect(config.name).toBe("gpt-4o");
			expect(config.vendor).toBe("OPENAI");
		});

		it("should throw error for non-existent model", () => {
			expect(() => {
				service.getLLMConfig("non-existent-model", AiVendor.OPENAI);
			}).toThrow("Model non-existent-model from vendor OPENAI not found in configuration");
		});

		it("should throw error for wrong vendor", () => {
			expect(() => {
				service.getLLMConfig("gpt-4o", AiVendor.ANTHROPIC);
			}).toThrow("Model gpt-4o from vendor ANTHROPIC not found in configuration");
		});
	});

	describe("getDefaultValues", () => {
		it("should return default values for model parameters", () => {
			const defaults = service.getDefaultValues("gpt-4o", AiVendor.OPENAI);
			expect(defaults).toBeDefined();
			expect(defaults.temperature).toBeDefined();
			expect(defaults.max_tokens).toBeDefined();
			expect(defaults.response_format).toBeDefined();
		});

		it("should return defaults matching model config", () => {
			const config = service.getLLMConfig("gpt-4o", AiVendor.OPENAI);
			const defaults = service.getDefaultValues("gpt-4o", AiVendor.OPENAI);

			expect(defaults.temperature).toBe(config.parameters.temperature?.default as number);
			expect(defaults.max_tokens).toBe(config.parameters.max_tokens?.default as number);
			expect(defaults.response_format).toBe(
				config.parameters.response_format?.default as string,
			);
		});

		it("should throw error for non-existent model", () => {
			expect(() => {
				service.getDefaultValues("non-existent-model", AiVendor.OPENAI);
			}).toThrow();
		});
	});

	describe("validateAndSanitizeConfig", () => {
		describe("basic parameter validation", () => {
			it("should use default values when parameters are undefined", () => {
				const config: ModelConfigParameters = {};
				const result = service.validateAndSanitizeConfig("gpt-4o", AiVendor.OPENAI, config);

				expect(result.temperature).toBeDefined();
				expect(result.max_tokens).toBeDefined();
				expect(result.response_format).toBeDefined();
			});

			it("should accept valid temperature value", () => {
				const config: ModelConfigParameters = { temperature: 0.5 };
				const result = service.validateAndSanitizeConfig("gpt-4o", AiVendor.OPENAI, config);

				expect(result.temperature).toBe(0.5);
			});

			it("should sanitize temperature below minimum", () => {
				const config: ModelConfigParameters = { temperature: -1 };
				const result = service.validateAndSanitizeConfig("gpt-4o", AiVendor.OPENAI, config);

				const modelConfig = service.getLLMConfig("gpt-4o", AiVendor.OPENAI);
				expect(result.temperature).toBe(
					modelConfig.parameters.temperature?.default as number,
				);
			});

			it("should sanitize temperature above maximum", () => {
				const config: ModelConfigParameters = { temperature: 5 };
				const result = service.validateAndSanitizeConfig("gpt-4o", AiVendor.OPENAI, config);

				const modelConfig = service.getLLMConfig("gpt-4o", AiVendor.OPENAI);
				expect(result.temperature).toBe(
					modelConfig.parameters.temperature?.default as number,
				);
			});

			it("should accept valid max_tokens value", () => {
				const config: ModelConfigParameters = { max_tokens: 1000 };
				const result = service.validateAndSanitizeConfig("gpt-4o", AiVendor.OPENAI, config);

				expect(result.max_tokens).toBe(1000);
			});

			it("should sanitize max_tokens below minimum", () => {
				const config: ModelConfigParameters = { max_tokens: 0 };
				const result = service.validateAndSanitizeConfig("gpt-4o", AiVendor.OPENAI, config);

				const modelConfig = service.getLLMConfig("gpt-4o", AiVendor.OPENAI);
				expect(result.max_tokens).toBe(
					modelConfig.parameters.max_tokens?.default as number,
				);
			});

			it("should sanitize max_tokens above maximum", () => {
				const config: ModelConfigParameters = { max_tokens: 999999 };
				const result = service.validateAndSanitizeConfig("gpt-4o", AiVendor.OPENAI, config);

				const modelConfig = service.getLLMConfig("gpt-4o", AiVendor.OPENAI);
				expect(result.max_tokens).toBe(
					modelConfig.parameters.max_tokens?.default as number,
				);
			});
		});

		describe("response_format validation", () => {
			it("should accept valid response_format value", () => {
				const config: ModelConfigParameters = { response_format: "json_object" };
				const result = service.validateAndSanitizeConfig("gpt-4o", AiVendor.OPENAI, config);

				expect(result.response_format).toBe("json_object");
			});

			it("should sanitize invalid response_format to default", () => {
				const config: ModelConfigParameters = {
					response_format: "invalid_format" as "text",
				};
				const result = service.validateAndSanitizeConfig("gpt-4o", AiVendor.OPENAI, config);

				const modelConfig = service.getLLMConfig("gpt-4o", AiVendor.OPENAI);
				expect(result.response_format).toBe(
					modelConfig.parameters.response_format?.default as string,
				);
			});

			it("should remove json_schema when response_format is json_object", () => {
				const config: ModelConfigParameters = {
					response_format: "json_object",
					json_schema: '{"type": "object"}',
				};
				const result = service.validateAndSanitizeConfig("gpt-4o", AiVendor.OPENAI, config);

				expect(result.response_format).toBe("json_object");
				expect(result.json_schema).toBeUndefined();
			});

			it("should remove json_schema when response_format is text", () => {
				const config: ModelConfigParameters = {
					response_format: "text",
					json_schema: '{"type": "object"}',
				};
				const result = service.validateAndSanitizeConfig("gpt-4o", AiVendor.OPENAI, config);

				expect(result.response_format).toBe("text");
				expect(result.json_schema).toBeUndefined();
			});

			it("should keep json_schema when response_format is json_schema with valid schema", () => {
				const config: ModelConfigParameters = {
					response_format: "json_schema",
					json_schema: '{"type": "object", "properties": {"name": {"type": "string"}}}',
				};
				const result = service.validateAndSanitizeConfig("gpt-4o", AiVendor.OPENAI, config);

				expect(result.response_format).toBe("json_schema");
				expect(result.json_schema).toBe(
					'{"type": "object", "properties": {"name": {"type": "string"}}}',
				);
			});

			it("should use empty object schema when response_format is json_schema but no schema provided", () => {
				const config: ModelConfigParameters = {
					response_format: "json_schema",
				};
				const result = service.validateAndSanitizeConfig("gpt-4o", AiVendor.OPENAI, config);

				expect(result.response_format).toBe("json_schema");
				expect(result.json_schema).toBe("{}");
			});

			it("should use empty object schema when response_format is json_schema but schema is empty string", () => {
				const config: ModelConfigParameters = {
					response_format: "json_schema",
					json_schema: "",
				};
				const result = service.validateAndSanitizeConfig("gpt-4o", AiVendor.OPENAI, config);

				expect(result.response_format).toBe("json_schema");
				expect(result.json_schema).toBe("{}");
			});

			it("should use empty object schema when response_format is json_schema but schema is whitespace", () => {
				const config: ModelConfigParameters = {
					response_format: "json_schema",
					json_schema: "   ",
				};
				const result = service.validateAndSanitizeConfig("gpt-4o", AiVendor.OPENAI, config);

				expect(result.response_format).toBe("json_schema");
				expect(result.json_schema).toBe("{}");
			});
		});

		describe("tools validation", () => {
			it("should accept valid tools array", () => {
				const config: ModelConfigParameters = {
					tools: [
						{
							name: "test_tool",
							description: "A test tool",
							parameters: {
								type: "object",
								properties: {
									name: {
										type: "string",
										description: "A name",
									},
								},
							},
						},
					],
				};
				const result = service.validateAndSanitizeConfig("gpt-4o", AiVendor.OPENAI, config);

				expect(result.tools).toBeDefined();
				expect(Array.isArray(result.tools)).toBe(true);
				expect(result.tools?.length).toBe(1);
			});

			it("should use default when tools is not an array", () => {
				const config: ModelConfigParameters = {
					tools: "not-an-array" as unknown as ModelConfigParameters["tools"],
				};
				const result = service.validateAndSanitizeConfig("gpt-4o", AiVendor.OPENAI, config);

				const modelConfig = service.getLLMConfig("gpt-4o", AiVendor.OPENAI);
				expect(result.tools).toEqual(modelConfig.parameters.tools?.default);
			});

			it("should use default when tools is undefined", () => {
				const config: ModelConfigParameters = {};
				const result = service.validateAndSanitizeConfig("gpt-4o", AiVendor.OPENAI, config);

				const modelConfig = service.getLLMConfig("gpt-4o", AiVendor.OPENAI);
				expect(result.tools).toEqual(modelConfig.parameters.tools?.default);
			});
		});

		describe("allowed values validation", () => {
			it("should sanitize value not in allowed list to default", () => {
				const config: ModelConfigParameters = {
					response_format: "invalid" as "text",
				};
				const result = service.validateAndSanitizeConfig("gpt-4o", AiVendor.OPENAI, config);

				const modelConfig = service.getLLMConfig("gpt-4o", AiVendor.OPENAI);
				expect(result.response_format).toBe(
					modelConfig.parameters.response_format?.default as string,
				);
			});

			it("should accept value in allowed list", () => {
				const config: ModelConfigParameters = {
					response_format: "json_object",
				};
				const result = service.validateAndSanitizeConfig("gpt-4o", AiVendor.OPENAI, config);

				expect(result.response_format).toBe("json_object");
			});
		});

		describe("complex scenarios", () => {
			it("should handle complete valid configuration", () => {
				const config: ModelConfigParameters = {
					temperature: 0.7,
					max_tokens: 2000,
					response_format: "json_object",
					tools: [],
				};
				const result = service.validateAndSanitizeConfig("gpt-4o", AiVendor.OPENAI, config);

				expect(result.temperature).toBe(0.7);
				expect(result.max_tokens).toBe(2000);
				expect(result.response_format).toBe("json_object");
				expect(result.tools).toEqual([]);
			});

			it("should handle partial configuration with defaults", () => {
				const config: ModelConfigParameters = {
					temperature: 0.5,
				};
				const result = service.validateAndSanitizeConfig("gpt-4o", AiVendor.OPENAI, config);

				expect(result.temperature).toBe(0.5);
				expect(result.max_tokens).toBeDefined();
				expect(result.response_format).toBeDefined();
			});

			it("should handle model without response_format parameter", () => {
				// Test with Anthropic model which might not have response_format
				const config: ModelConfigParameters = {
					temperature: 0.5,
					max_tokens: 1000,
				};
				const result = service.validateAndSanitizeConfig(
					"claude-3-7-sonnet-latest",
					AiVendor.ANTHROPIC,
					config,
				);

				expect(result.temperature).toBe(0.5);
				expect(result.max_tokens).toBe(1000);
			});

			it("should ensure all required parameters are present in result", () => {
				const config: ModelConfigParameters = {};
				const result = service.validateAndSanitizeConfig("gpt-4o", AiVendor.OPENAI, config);

				const modelConfig = service.getLLMConfig("gpt-4o", AiVendor.OPENAI);
				const paramKeys = Object.keys(modelConfig.parameters);

				// All parameters from model config should have values in result
				for (const paramKey of paramKeys) {
					if (paramKey === "json_schema") {
						// json_schema is conditionally added
						continue;
					}
					expect(result[paramKey as keyof ModelConfigParameters]).toBeDefined();
				}
			});
		});

		describe("error handling", () => {
			it("should throw error for non-existent model", () => {
				expect(() => {
					service.validateAndSanitizeConfig("non-existent-model", AiVendor.OPENAI, {});
				}).toThrow();
			});

			it("should throw error for wrong vendor", () => {
				expect(() => {
					service.validateAndSanitizeConfig("gpt-4o", AiVendor.ANTHROPIC, {});
				}).toThrow();
			});
		});
	});
});
