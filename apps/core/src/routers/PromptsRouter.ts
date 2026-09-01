import { Router } from "express";
import { PromptsController } from "../controllers/prompt.controller";
import { asyncHandler } from "@/utils/asyncHandler";

export function createPromptsRouter(): Router {
	const router = Router();
	const promptsController = new PromptsController();

	// Agent
	router.get(
		"/:id/agent",
		asyncHandler(promptsController.getChatMessages.bind(promptsController)),
	);
	router.post(
		"/:id/agent/message",
		asyncHandler(promptsController.agent.bind(promptsController)),
	);
	// new chat
	router.post(
		"/:id/agent/new-chat",
		asyncHandler(promptsController.newChatStart.bind(promptsController)),
	);

	// Prompt Auditor
	router.post("/:id/audit", asyncHandler(promptsController.auditPrompt.bind(promptsController)));

	// Prompt Editor
	// router.post('/:id/edit', async (req, res, next) => {
	// 	promptsController.editPrompt(req, res, next);
	// });

	// Assertion Editor
	router.post(
		"/:id/assertion",
		asyncHandler(promptsController.editAssertion.bind(promptsController)),
	);

	// JSON schema
	router.post(
		"/:id/json-schema",
		asyncHandler(promptsController.editJsonSchema.bind(promptsController)),
	);

	// Tool generator
	router.post("/:id/tool", asyncHandler(promptsController.editTool.bind(promptsController)));

	// Input generator
	router.post(
		"/:id/input",
		asyncHandler(promptsController.generateInput.bind(promptsController)),
	);

	// Models
	router.get("/models", asyncHandler(promptsController.getModels.bind(promptsController)));
	router.get(
		"/models/:id",
		asyncHandler(promptsController.getModelConfig.bind(promptsController)),
	);
	router.put(
		"/:id/config",
		asyncHandler(promptsController.saveModelConfig.bind(promptsController)),
	);
	router.patch(
		"/:id/model/:modelId",
		asyncHandler(promptsController.changePromptModel.bind(promptsController)),
	);

	// Core Prompt CRUD operations
	router.get("/", asyncHandler(promptsController.getProjectPrompts.bind(promptsController)));
	router.post("/", asyncHandler(promptsController.createPrompt.bind(promptsController)));

	// Memories endpoints
	router.get("/memories", asyncHandler(promptsController.getAllMemories.bind(promptsController)));
	router.get(
		"/:id/memories",
		asyncHandler(promptsController.getMemoriesByPromptId.bind(promptsController)),
	);
	router.post(
		"/:id/memories",
		asyncHandler(promptsController.createMemory.bind(promptsController)),
	);
	router.get(
		"/:id/memories/:memoryId",
		asyncHandler(promptsController.getMemoryById.bind(promptsController)),
	);
	router.put(
		"/:id/memories/:memoryId",
		asyncHandler(promptsController.updateMemory.bind(promptsController)),
	);
	router.delete(
		"/:id/memories/:memoryId",
		asyncHandler(promptsController.deleteMemory.bind(promptsController)),
	);

	// Placeholders endpoints
	router.get(
		"/:id/placeholders",
		asyncHandler(promptsController.getPlaceholdersByPromptId.bind(promptsController)),
	);
	router.post(
		"/:id/placeholders",
		asyncHandler(promptsController.createPlaceholder.bind(promptsController)),
	);
	router.get(
		"/:id/placeholders/:placeholderId",
		asyncHandler(promptsController.getPlaceholderById.bind(promptsController)),
	);
	router.put(
		"/:id/placeholders/:placeholderId",
		asyncHandler(promptsController.updatePlaceholder.bind(promptsController)),
	);
	router.delete(
		"/:id/placeholders/:placeholderId",
		asyncHandler(promptsController.deletePlaceholder.bind(promptsController)),
	);
	router.post(
		"/:id/placeholders/:placeholderId/values",
		asyncHandler(promptsController.createPlaceholderValue.bind(promptsController)),
	);
	router.put(
		"/:id/placeholders/:placeholderId/values/:valueId",
		asyncHandler(promptsController.updatePlaceholderValue.bind(promptsController)),
	);
	router.delete(
		"/:id/placeholders/:placeholderId/values/:valueId",
		asyncHandler(promptsController.deletePlaceholderValue.bind(promptsController)),
	);

	// Execution endpoints
	router.get("/:id/logs", asyncHandler(promptsController.getPromptLogs.bind(promptsController)));
	router.post("/:id/run", asyncHandler(promptsController.runPrompt.bind(promptsController)));

	// Version control
	router.post(
		"/:id/commit",
		asyncHandler(promptsController.commitPrompt.bind(promptsController)),
	);
	router.get(
		"/:id/commit/generate",
		asyncHandler(promptsController.generateCommit.bind(promptsController)),
	);
	router.get(
		"/:id/commit/:commitId",
		asyncHandler(promptsController.getCommit.bind(promptsController)),
	);
	router.post(
		"/:id/commit/:commitId/rollback",
		asyncHandler(promptsController.rollbackPrompt.bind(promptsController)),
	);
	router.get(
		"/:id/branches",
		asyncHandler(promptsController.getBranches.bind(promptsController)),
	);
	router.get(
		"/:id/branches/:branch/commits",
		asyncHandler(promptsController.getCommitsByBranch.bind(promptsController)),
	);

	// Testcases
	router.get(
		"/:id/testcases",
		asyncHandler(promptsController.getTestcasesByPromptId.bind(promptsController)),
	);

	// Core Prompt CRUD operations
	router.get("/:id", asyncHandler(promptsController.getPromptById.bind(promptsController)));
	router.put("/:id", asyncHandler(promptsController.updatePrompt.bind(promptsController)));
	router.delete("/:id", asyncHandler(promptsController.deletePrompt.bind(promptsController)));

	return router;
}
