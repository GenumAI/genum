-- Both changes here serve one endpoint, `GET /prompts/:id/logs`, which was refused in
-- production with:
--
--   Amount of memory requested to allocate is more than allowed
--   (while reading column placeholders) ... from mark 5 with max_rows_to_read = 1
--
-- `max_rows_to_read = 1` is the tell: a single row could not be read. The dictionary of a
-- LowCardinality column is per-part and must be loaded whole before any row of it is
-- readable, so on a large merged part the width of the dictionary -- not the width of the
-- page -- decides whether the query fits in memory. Placeholder VALUES are variant names
-- chosen per run and grow without bound; only the KEYS are the small fixed set
-- LowCardinality is for, so the value side loses it.
-- Operationally: this returns as soon as the metadata changes, and ClickHouse rewrites the
-- column part by part in the background. Until a part is rewritten, reading `placeholders`
-- FROM IT still loads the old dictionary -- so the list endpoint is safe the moment this
-- ships (it no longer reads the column at all), while the details dialog is only fully out
-- of danger once `SELECT * FROM system.mutations WHERE table = 'logs' AND NOT is_done`
-- comes back empty. Worth watching after deploying.
ALTER TABLE {{DB_NAME}}.logs
    MODIFY COLUMN placeholders Map(LowCardinality(String), String);

-- The second half of the same defect: the list query was `SELECT *`, and it was `SELECT *`
-- because the details dialog reads `in`, `out` and `placeholders` off the row the list
-- already handed it -- there was no way to ask for one row. So every page of 10 dragged
-- the full payload of every scanned row through the sort. `log_id` gives a row an address,
-- and the list can then stop reading the payload at all.
--
-- MATERIALIZED rather than a stored UUID backfilled by a mutation: ClickHouse evaluates
-- the expression on read for parts written before this migration, so the whole history is
-- addressable without rewriting `prod.logs`. Two constraints on the expression, both
-- load-bearing:
--
--   * every input is non-nullable -- one Nullable argument makes cityHash64 return
--     Nullable, and a null id addresses nothing;
--   * no input is `in` or `out` -- computing an id must never read the payload, which is
--     the cost this column exists to avoid.
--
-- Two rows collide only by agreeing on all fourteen fields including the millisecond, at
-- which point they are indistinguishable to the dialog anyway.
ALTER TABLE {{DB_NAME}}.logs
    ADD COLUMN IF NOT EXISTS log_id UInt64 MATERIALIZED cityHash64(
        toUnixTimestamp64Milli(timestamp),
        orgId,
        project_id,
        prompt_id,
        source,
        log_lvl,
        log_type,
        vendor,
        model,
        tokens_in,
        tokens_out,
        tokens_sum,
        cost,
        response_ms
    );
