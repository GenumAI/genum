-- Where a span came from: our own run, or a customer's trace sent over OTLP.
--
-- Ingested traces are not metered and their cost is written as zero. That decision is only
-- revisitable if the rows say which they are: `trace_spans` is append-only, so a row that
-- does not record its origin can never be made to, and no future query could separate a
-- customer's traces from our own runs. Without this column "not metered for now" is not a
-- decision anyone can come back to -- it is permanent. One low-cardinality column now, or
-- the whole accumulated history later.
--
-- `logs` already carries `source` for the same reason (`SourceType.ui`); this is its
-- counterpart one level down.
--
-- DEFAULT rather than Nullable: every row written before this migration is one of ours, so
-- 'genum' is not a guess about them, it is a fact about them.
ALTER TABLE {{DB_NAME}}.trace_spans
    ADD COLUMN IF NOT EXISTS source LowCardinality(String) DEFAULT 'genum';
