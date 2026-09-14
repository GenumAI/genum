-- Added 2026-09-03 with agentic tool testing. A log row is the root span of a run;
-- `trace_id` is NULL for every single-shot run, which is every row written before this.
ALTER TABLE {{DB_NAME}}.logs
    ADD COLUMN IF NOT EXISTS trace_id Nullable(String);

-- Steps of an agentic run. Column names follow the OpenTelemetry GenAI semantic
-- conventions so that ingesting external traces later is a mapping, not a rewrite.
CREATE TABLE IF NOT EXISTS {{DB_NAME}}.trace_spans
(
    timestamp DateTime64(3) DEFAULT now64(),

    trace_id String,
    span_id String,
    parent_span_id Nullable(String),
    span_index UInt16,
    span_type LowCardinality(String),

    orgId UInt32,
    project_id UInt32,
    prompt_id UInt32,

    name String,
    input String,
    output String,
    tool_args String,
    tool_result String,
    tool_error Nullable(String),

    vendor LowCardinality(String),
    model String,
    tokens_in UInt32,
    tokens_out UInt32,
    cost Float64,
    duration_ms UInt32,
    status LowCardinality(String)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (orgId, project_id, trace_id, span_index)
SETTINGS index_granularity = 8192;
