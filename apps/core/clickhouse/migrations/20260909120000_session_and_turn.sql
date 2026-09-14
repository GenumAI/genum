-- Added 2026-09-09 with the session model. Before this, one trace WAS one session and
-- `span_index` ran across every turn of it; a writer therefore had to know how many spans
-- preceded it, and an append-only table cannot correct a writer that got that wrong.
--
-- A trace is now one TURN, `session_id` groups the turns of a conversation, and
-- `span_index` restarts at zero in every turn.
--
-- `String DEFAULT ''` rather than Nullable: every row written before this reads as
-- "no session", which the read path defines as a session consisting of that one trace.
-- That is not a fallback -- for those rows the trace genuinely was the whole session.
-- No mutation over history, and no backfill.
ALTER TABLE {{DB_NAME}}.trace_spans
    ADD COLUMN IF NOT EXISTS session_id String DEFAULT '',
    ADD COLUMN IF NOT EXISTS turn_index UInt16 DEFAULT 0;
