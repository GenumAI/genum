# ClickHouse migrations

Applied in filename order by `pnpm clickhouse:migrate:dev` (or `:prod`). Never edit an
applied file — the runner records a checksum and will refuse to run. Add a new one.

- Name: `<UTC timestamp>_<slug>.sql`, e.g. `20260915103000_drop_memory_key.sql`.
- **Qualify every object with `{{DB_NAME}}`.** It is substituted at runtime. An
  unqualified `CREATE TABLE logs` lands in whatever the session database happens to be.
- **One file, one logical change.** ClickHouse has no transactional DDL, so a file that
  fails halfway leaves its earlier statements applied.
- `pnpm clickhouse:status:dev` prints applied, pending and drifted, and exits non-zero on
  drift.
