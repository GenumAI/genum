-- AlterTable
ALTER TABLE "TestCase" ADD COLUMN     "expectedSteps" JSONB,
ADD COLUMN     "lastSteps" JSONB,
ADD COLUMN     "stepsConfig" JSONB;
