-- The split of a run's usage: how much of its input the vendor served from or wrote to its
-- cache, how much of its output was reasoning, and what each of those cost.
--
-- Recorded at write time because it exists nowhere else. The counts are in the vendor's
-- response to that one call, and the costs depend on the prices in force when the run was
-- billed (DeepSeek's change by the hour). Neither can be derived later.
--
-- Every column is a SUBSET of a column that already exists (tokens_in, tokens_out or cost),
-- never a new total. So every sum(tokens_in) and sum(cost) in queries.ts keeps its meaning,
-- and a zero reads the same on every row: nothing to show. A row written before this
-- migration recorded no split, and a new row without a cache has none.
--
-- log_id is not touched. It hashes a fixed list of columns that does not include these.
ALTER TABLE {{DB_NAME}}.logs
    ADD COLUMN IF NOT EXISTS tokens_in_cache_read UInt32 DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tokens_in_cache_write UInt32 DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tokens_out_reasoning UInt32 DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cost_in_cache_read Float64 DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cost_in_cache_write Float64 DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cost_out_reasoning Float64 DEFAULT 0;
