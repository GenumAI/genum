import { Router } from "express";
import { PromptsController } from "../controllers/prompt.controller";
import { PromptVersionsController } from "../controllers/prompt-versions.controller";
import { PlaceholdersController } from "../controllers/placeholder.controller";
import { PromptModelsController } from "../controllers/prompt-models.controller";
import { PromptAssistantController } from "../controllers/prompt-assistant.controller";
import { asyncHandler } from "@/utils/asyncHandler";

export function createPromptsRouter(): Router {
	const router = Router();
	const promptsController = new PromptsController();
	const versionsController = new PromptVersionsController();
	const placeholdersController = new PlaceholdersController();
	const modelsController = new PromptModelsController();
	const assistantController = new PromptAssistantController();

	// Registration order is load-bearing and deliberately NOT grouped by controller:
	// Express matches in the order routes are added, so "/models" must stay in front of
	// "/:id" and "/:id/commit/generate" in front of "/:id/commit/:commitId".
	// PromptsRouter.test.ts pins the whole sequence.

	// Agent
	router.get(
		"/:id/agent",
		asyncHandler(assistantController.getChatMessages.bind(assistantController)),
	);
	router.post(
		"/:id/agent/message",
		asyncHandler(assistantController.agent.bind(assistantController)),
	);
	// new chat
	router.post(
		"/:id/agent/new-chat",
		asyncHandler(assistantController.newChatStart.bind(assistantController)),
	);

	// Prompt Auditor
	router.post(
		"/:id/audit",
		asyncHandler(assistantController.auditPrompt.bind(assistantController)),
	);

	// Prompt Editor
	// router.post('/:id/edit', async (req, res, next) => {
	// 	assistantController.editPrompt(req, res, next);
	// });

	// Assertion Editor
	router.post(
		"/:id/assertion",
		asyncHandler(assistantController.editAssertion.bind(assistantController)),
	);

	// JSON schema
	router.post(
		"/:id/json-schema",
		asyncHandler(assistantController.editJsonSchema.bind(assistantController)),
	);

	// Tool generator
	router.post("/:id/tool", asyncHandler(assistantController.editTool.bind(assistantController)));

	// Input generator
	router.post(
		"/:id/input",
		asyncHandler(assistantController.generateInput.bind(assistantController)),
	);

	// Models
	router.get("/models", asyncHandler(modelsController.getModels.bind(modelsController)));
	router.get("/models/:id", asyncHandler(modelsController.getModelConfig.bind(modelsController)));
	router.put(
		"/:id/config",
		asyncHandler(modelsController.saveModelConfig.bind(modelsController)),
	);
	router.patch(
		"/:id/model/:modelId",
		asyncHandler(modelsController.changePromptModel.bind(modelsController)),
	);

	// Core Prompt CRUD operations
	router.get("/", asyncHandler(promptsController.getProjectPrompts.bind(promptsController)));
	router.post("/", asyncHandler(promptsController.createPrompt.bind(promptsController)));

	// Placeholders endpoints
	router.get(
		"/:id/placeholders",
		asyncHandler(placeholdersController.getPlaceholdersByPromptId.bind(placeholdersController)),
	);
	router.post(
		"/:id/placeholders",
		asyncHandler(placeholdersController.createPlaceholder.bind(placeholdersController)),
	);
	router.get(
		"/:id/placeholders/:placeholderId",
		asyncHandler(placeholdersController.getPlaceholderById.bind(placeholdersController)),
	);
	router.put(
		"/:id/placeholders/:placeholderId",
		asyncHandler(placeholdersController.updatePlaceholder.bind(placeholdersController)),
	);
	router.delete(
		"/:id/placeholders/:placeholderId",
		asyncHandler(placeholdersController.deletePlaceholder.bind(placeholdersController)),
	);
	router.post(
		"/:id/placeholders/:placeholderId/values",
		asyncHandler(placeholdersController.createPlaceholderValue.bind(placeholdersController)),
	);
	router.put(
		"/:id/placeholders/:placeholderId/values/:valueId",
		asyncHandler(placeholdersController.updatePlaceholderValue.bind(placeholdersController)),
	);
	router.delete(
		"/:id/placeholders/:placeholderId/values/:valueId",
		asyncHandler(placeholdersController.deletePlaceholderValue.bind(placeholdersController)),
	);

	// Execution endpoints
	router.get("/:id/logs", asyncHandler(promptsController.getPromptLogs.bind(promptsController)));
	// Registered after "/:id/logs" but on a distinct path, so ordering is not load-bearing.
	router.get(
		"/:id/logs/detail",
		asyncHandler(promptsController.getPromptLogDetail.bind(promptsController)),
	);
	router.post("/:id/run", asyncHandler(promptsController.runPrompt.bind(promptsController)));

	// Version control
	router.post(
		"/:id/commit",
		asyncHandler(versionsController.commitPrompt.bind(versionsController)),
	);
	router.get(
		"/:id/commit/generate",
		asyncHandler(versionsController.generateCommit.bind(versionsController)),
	);
	router.get(
		"/:id/commit/:commitId",
		asyncHandler(versionsController.getCommit.bind(versionsController)),
	);
	router.post(
		"/:id/commit/:commitId/rollback",
		asyncHandler(versionsController.rollbackPrompt.bind(versionsController)),
	);
	router.get(
		"/:id/branches",
		asyncHandler(versionsController.getBranches.bind(versionsController)),
	);
	router.get(
		"/:id/branches/:branch/commits",
		asyncHandler(versionsController.getCommitsByBranch.bind(versionsController)),
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
