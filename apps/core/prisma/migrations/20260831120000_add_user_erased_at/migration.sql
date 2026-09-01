-- AlterTable
-- Marks a tombstoned (closed) account. NULL for every live user, so the column is
-- additive and nothing existing needs a backfill.
ALTER TABLE "User" ADD COLUMN "erasedAt" TIMESTAMP(6);
