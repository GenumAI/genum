import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `logs.keys` reaches the axios client through `scope.keys`; only the two workspace getters
// are needed, and the real module reads runtime config that a node test does not have.
vi.mock("@/api/client", () => ({ getOrgId: () => "1", getProjectId: () => "2" }));
vi.mock("@/api/project/project.api", () => ({ projectApi: { getTraceSpans: vi.fn() } }));

import { projectApi } from "@/api/project/project.api";
import type { SpanRow } from "@/types/spans";
import { traceSpansQuery, trajectoryQuery } from "./traceSpansQuery";

function row(overrides: Partial<SpanRow>): SpanRow {
	return {
		trace_id: "turn-0",
		span_id: "span",
		parent_span_id: null,
		span_index: 0,
		span_type: "chat",
		orgId: 1,
		project_id: 2,
		prompt_id: 3,
		name: "",
		input: "",
		output: "",
		tool_args: "",
		tool_result: "",
		tool_error: null,
		vendor: "openai",
		model: "gpt-4o",
		tokens_in: 0,
		tokens_out: 0,
		cost: 0,
		duration_ms: 0,
		status: "OK",
		...overrides,
	};
}

// A session the log renders as three steps: a reply, a tool call, and an answer. Not a
// single answer, which is what makes the log section render and the pin open its picker.
const SPANS: SpanRow[] = [
	row({ span_id: "a", span_index: 0, span_type: "user", output: "any meetings today?" }),
	row({
		span_id: "b",
		span_index: 1,
		span_type: "execute_tool",
		name: "execute_tool searchCalendarEvents",
		tool_args: '{"start":"2026-09-14"}',
		tool_result: '{"events":[]}',
	}),
	row({ span_id: "c", span_index: 2, span_type: "chat", output: "No meetings today." }),
];

describe("the trace spans cache entry", () => {
	let client: QueryClient;

	beforeEach(() => {
		client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		vi.mocked(projectApi.getTraceSpans).mockResolvedValue({ spans: SPANS });
	});

	afterEach(() => {
		client.clear();
	});

	it("keeps the open log's steps when a testcase is added from that log", async () => {
		// The log dialog stays open while "Add testcase" reads the very same session. The
		// two share one cache entry, so the pin's read must not leave the log section
		// holding something it cannot render -- which is what crashed the dialog with
		// "Cannot read properties of undefined (reading 'length')".
		const logSection = new QueryObserver(client, trajectoryQuery("session-1"));
		const unsubscribe = logSection.subscribe(() => {});
		await vi.waitFor(() => expect(logSection.getCurrentResult().isSuccess).toBe(true));
		const loadedAt = logSection.getCurrentResult().dataUpdatedAt;

		const pinned = await client.fetchQuery(traceSpansQuery("session-1"));
		await vi.waitFor(() =>
			expect(logSection.getCurrentResult().dataUpdatedAt).toBeGreaterThan(loadedAt),
		);

		expect(pinned.spans).toHaveLength(3);
		expect(logSection.getCurrentResult().data?.steps).toHaveLength(3);
		unsubscribe();
	});

	it("gives the pin the spans when it reads what the open log already loaded", async () => {
		// The other direction of the same collision: a read served from the cache instead
		// of the network hands back whatever the log section stored there.
		const logSection = new QueryObserver(client, trajectoryQuery("session-1"));
		const unsubscribe = logSection.subscribe(() => {});
		await vi.waitFor(() => expect(logSection.getCurrentResult().isSuccess).toBe(true));

		const pinned = await client.fetchQuery({
			...traceSpansQuery("session-1"),
			staleTime: Number.POSITIVE_INFINITY,
		});

		expect(pinned.spans).toHaveLength(3);
		unsubscribe();
	});
});
