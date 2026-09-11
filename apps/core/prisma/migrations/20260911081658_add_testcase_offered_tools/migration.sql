-- AlterTable
ALTER TABLE "TestCase" ADD COLUMN     "offeredTools" JSONB,
ADD COLUMN     "pinnedSelectionDrift" BOOLEAN NOT NULL DEFAULT false;
