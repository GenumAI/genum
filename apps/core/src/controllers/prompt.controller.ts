import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { db } from "@/database/db";
import { runPrompt } from "../ai/runner/run";
import { getLogDetail, getPromptLogs } from "../services/logger/logger";
import {
	LogDetailQuerySchema,
	PromptLogsQuerySchema,
	PromptCreateSchema,
	PromptRunSchema,
	PromptUpdateSchema,
	numberSchema,
} from "@/services/validate";
import { PromptService } from "@/services/prompt.service";
import { checkPromptAccess } from "@/services/access/AccessService";
import {
	deriveTurnTraceId,
	type LogDocument,
	LogType,
	logSpans,
	logUsage,
	SourceType,
} from "@/services/logger";
import { finishedTurnSteps, conversationNumberingProblem } from "@/ai/steps/turn";
import { HttpError } from "@/utils/errors";
import { fileService } from "@/services/file.service";

export class PromptsController {
	private promptService: PromptService;

	constructor() {
		this.promptService = new PromptService(db);
	}

	public async getProjectPrompts(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const prompts = await db.prompts.getProjectPrompts(metadata.projID);

		// One aggregate for the whole project rather than one full read of every testcase
		// per prompt: the list renders counts, and a testcase row carries three unbounded
		// TEXT columns none of them look at.
		const statusesByPrompt = statusCountsByPrompt(
			await db.testcases.countByStatusForProject(metadata.projID),
		);

		const promptsWithStatuses = prompts.map((prompt) => {
			const lastCommit = prompt.branches[0]?.promptVersions[0] || null;
			const { branches: _, ...promptWithoutBranches } = prompt;
			return {
				...promptWithoutBranches,
				testcaseStatuses: statusesByPrompt.get(prompt.id) ?? {},
				lastCommit,
			};
		});

		res.status(200).json({ prompts: promptsWithStatuses });
	}

	/**
	 * One turn of a playground run.
	 *
	 * The agentic loop this endpoint serves runs in the BROWSER: a tool is never executed
	 * by Genum, the author types its result in, so a three-turn trajectory arrives as
	 * three independent HTTP requests and the server can never know which one is the last.
	 * That rules out the shape `TestcasesController.runTestcase` uses (hold every turn's
	 * usage, write one summed root row at the end): usage held for a "final" turn that
	 * never comes is usage lost every time an author abandons a trajectory half-authored.
	 *
	 * So each turn writes its own row as it happens -- quota is charged per turn either
	 * way -- and the turns are tied together by a `trace_id` that turn 1 mints and the
	 * client echoes back. Turn 1 logs as `PromptRunSuccess`, turns 2..N as
	 * `PromptRunTurn`, which keeps a trajectory counted once by run counts. COST IS
	 * SPLIT ACROSS BOTH TYPES: a trajectory's full cost is `sum(cost)` over `prs` + `prt`
	 * for one `trace_id`, never the `prs` row alone.
	 */
	public async runPrompt(req: Request, res: Response) {
		const id = numberSchema.parse(req.params.id);
		const {
			question,
			files: filesIds,
			placeholders,
			messages,
			traceId: continuedTraceId,
		} = PromptRunSchema.parse(req.body);

		// Before anything is billed or written: a conversation whose shape the trace
		// numbering cannot read is refused rather than repaired, because `trace_spans` is
		// append-only and a mis-numbered span is permanent. See
		// `conversationNumberingProblem`. Checked here, not inside `PromptRunSchema`,
		// because it is an invariant BETWEEN messages that only the code deriving the
		// numbering can state -- and it belongs beside that code, in `turn.ts`.
		const numberingProblem = conversationNumberingProblem(messages);
		if (numberingProblem) {
			throw new HttpError(400, numberingProblem);
		}

		const metadata = req.genumMeta.ids;
		const files = await fileService.getFileObjectsByIds(filesIds, metadata.projID);

		const prompt = await checkPromptAccess(id, metadata.projID);

		let turnUsage: LogDocument | undefined;
		const run = await runPrompt({
			prompt: prompt,
			question,
			source: SourceType.ui,
			userProjectId: metadata.projID,
			userOrgId: metadata.orgID,
			user_id: metadata.userID,
			files: files,
			placeholders: placeholders ?? {},
			// Absent for a single-shot run -- the playground sends the accumulated
			// conversation back only once the author has supplied a tool result.
			messages,
			// Diverted only so the trace can be stamped on it below; it is written on
			// every path that would have written it, in the same turn, unsummed.
			collectUsage: (usage) => {
				turnUsage = usage;
			},
		});

		const lastMessage = messages?.[messages.length - 1];
		// A human asking the next question is a new run; the model fetching a tool result
		// inside one question is not. Keyed on what the continuation carries, because
		// `traceId` alone cannot tell the two apart, and counting them alike makes a
		// ten-question conversation one run with its success rate over a denominator of one.
		const isUserContinuation = lastMessage?.role === "user";
		const isToolContinuation = messages !== undefined && !isUserContinuation;
		// Every run opens a session, whether or not it called a tool. A plainly answered
		// question is a session of one turn that the author may continue with a follow-up,
		// and ClickHouse is append-only: a session minted later can never be joined to the
		// `logs` row and the spans of the turn that came before it. Minting only once a
		// tool was called is what made a plain first answer uncontinuable -- turn 1 was
		// recorded under no session, so turn 2 had nothing to attach to and the reply
		// control had nowhere to appear. A continuation carries back the session it was
		// given (the client only echoes; it never mints one of its own).
		const traceId = continuedTraceId ?? randomUUID();

		if (turnUsage) {
			await logUsage({
				...turnUsage,
				trace_id: traceId,
				log_type: isToolContinuation ? LogType.PromptRunTurn : turnUsage.log_type,
			});
		}

		// One batch per turn, written on the request the turn ends on. `traceId` addresses
		// the SESSION -- it always has -- and the turn gets its own trace id here, so that
		// a trace is one turn, the way the GenAI conventions have it.
		const turn = finishedTurnSteps(messages, run);
		if (turnUsage && turn && turn.steps.length > 0) {
			await logSpans({
				trace_id: deriveTurnTraceId(traceId, turn.turnIndex),
				session_id: traceId,
				turn_index: turn.turnIndex,
				orgId: turnUsage.orgId,
				project_id: turnUsage.project_id,
				prompt_id: turnUsage.prompt_id,
				vendor: turnUsage.vendor,
				model: turnUsage.model,
				steps: turn.steps,
			});
		}

		res.status(200).json({ ...run, traceId });
	}

	public async getPromptById(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const id = numberSchema.parse(req.params.id);

		await checkPromptAccess(id, metadata.projID);

		// This page is the only reader of the commit history, so it is the only caller
		// that pays for the branches -> promptVersions payload -- the guard above stopped
		// carrying it for the other thirty-odd routes on this router.
		const prompt = await db.prompts.getPromptByIdWithHistory(id);
		if (!prompt) {
			res.status(404).json({ error: "Prompt is not found" });
			return;
		}

		const statusCounts =
			statusCountsByPrompt(await db.testcases.countByStatusForPrompt(id)).get(id) ?? {};

		const lastVersion = prompt.branches[0]?.promptVersions[0];

		// Omit branches from the response
		const { branches: _, ...promptWithoutBranches } = prompt;
		const promptWithStatuses = {
			...promptWithoutBranches,
			testcaseStatuses: statusCounts,
			lastCommit: lastVersion?.commitHash || null,
			lastCommitAuthor: lastVersion?.authorId || null,
		};

		res.status(200).json({ prompt: promptWithStatuses });
	}

	public async createPrompt(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const data = PromptCreateSchema.parse(req.body);

		const prompt = await db.prompts.newProjectPrompt(metadata.projID, data, metadata.userID);

		res.status(200).json({ prompt });
	}

	public async deletePrompt(req: Request, res: Response) {
		const id = numberSchema.parse(req.params.id);
		const metadata = req.genumMeta.ids;

		await checkPromptAccess(id, metadata.projID);

		await db.prompts.deletePromptById(id);
		res.status(200).json({ id });
	}

	public async updatePrompt(req: Request, res: Response) {
		const id = numberSchema.parse(req.params.id);
		const data = PromptUpdateSchema.parse(req.body);
		const metadata = req.genumMeta.ids;

		await checkPromptAccess(id, metadata.projID);

		const updatedPrompt = await db.prompts.updatePromptById(id, data);
		const updatedPromptWithStatus =
			await this.promptService.updateCommitedStatus(updatedPrompt);

		res.status(200).json({ prompt: updatedPromptWithStatus });
	}

	public async getTestcasesByPromptId(req: Request, res: Response) {
		const id = numberSchema.parse(req.params.id);
		const metadata = req.genumMeta.ids;

		await checkPromptAccess(id, metadata.projID);

		// This is the one call site that opts into placeholderValues: it backs the
		// playground's testcase list, which seeds the placeholder chips from each
		// testcase's pin (Task 9 fix round 2). Every other caller of
		// getTestcasesByPromptId only reads status/summary fields and leaves the
		// default (off).
		const testcases = await db.testcases.getTestcasesByPromptId(id, {
			includePlaceholders: true,
		});
		res.status(200).json({ testcases });
	}

	public async getPromptLogs(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);

		await checkPromptAccess(promptId, metadata.projID);

		const query = PromptLogsQuerySchema.parse(req.query);

		const result = await getPromptLogs(
			metadata.orgID,
			metadata.projID,
			promptId,
			query.page,
			query.pageSize,
			query.fromDate,
			query.toDate,
			query.source,
			query.logLevel,
			query.query,
		);

		res.status(200).json(result);
	}

	/**
	 * The payload of a single log row. Split out of the list so that `in`, `out` and
	 * `placeholders` are read for the one row a user opened rather than for every row a
	 * page scanned.
	 */
	public async getPromptLogDetail(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);

		await checkPromptAccess(promptId, metadata.projID);

		const { logId, timestamp } = LogDetailQuerySchema.parse(req.query);

		const detail = await getLogDetail({
			orgId: metadata.orgID,
			projectId: metadata.projID,
			promptId,
			logId,
			timestamp,
		});

		if (!detail) {
			return res.status(404).json({ error: "Log not found" });
		}

		res.status(200).json(detail);
	}
}

/**
 * Pivots the testcase status aggregate into the per-prompt histogram both prompt
 * responses carry. A status with no testcases has no row in the aggregate and so stays
 * out of the histogram entirely -- that absent key is what the per-row reducer this
 * replaced produced, and what the web client already reads as zero. A prompt with no
 * testcases at all has no entry either, so callers default it to `{}` rather than letting
 * the key fall out of the response.
 */
function statusCountsByPrompt(rows: { promptId: number; status: string; _count: number }[]) {
	const byPrompt = new Map<number, Record<string, number>>();
	for (const row of rows) {
		const counts = byPrompt.get(row.promptId) ?? {};
		counts[row.status] = (counts[row.status] ?? 0) + row._count;
		byPrompt.set(row.promptId, counts);
	}
	return byPrompt;
}
