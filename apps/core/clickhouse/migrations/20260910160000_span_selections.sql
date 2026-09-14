-- What the turn was actually run WITH: which placeholder value each key resolved to, which
-- tools the model was offered, and which version of the prompt produced the instruction.
--
-- Ingest stored none of this, so a session pinned from a privileged user replayed with the
-- prompt's DEFAULT placeholder values and with every tool the prompt defines. Both are
-- silent: the replay runs, produces a different answer than the recording, and the testcase
-- is written NOK for a difference the author never made. A trajectory recorded under one
-- set of inputs and replayed under another is not a regression test of anything.
--
-- `trace_spans` is append-only, so these have to be columns on the row rather than
-- something derived later: a turn already ingested can never be told what it ran with.
--
-- Typed rather than kept as the JSON they arrive as. `placeholders` mirrors the column of
-- the same name and shape on `logs` (key -> value NAME, not its content: the content is
-- the prompt's to hold and can be edited after the fact, while the name is the selection
-- that was made). `tools_offered` holds names only -- the definitions belong to the prompt,
-- and a replay needs to know which subset was on the table, not to reconstruct them.
--
-- Defaults are the empty value, and empty means "not recorded", never "none": a row written
-- before this migration, or by a sender that supplies no such attribute, must keep replaying
-- the way it does today rather than suddenly replay with zero tools.
ALTER TABLE {{DB_NAME}}.trace_spans
    ADD COLUMN IF NOT EXISTS placeholders Map(String, String);

ALTER TABLE {{DB_NAME}}.trace_spans
    ADD COLUMN IF NOT EXISTS tools_offered Array(String);

ALTER TABLE {{DB_NAME}}.trace_spans
    ADD COLUMN IF NOT EXISTS prompt_version String DEFAULT '';
