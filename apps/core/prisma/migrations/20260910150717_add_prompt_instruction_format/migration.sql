-- CreateEnum
CREATE TYPE "InstructionFormat" AS ENUM ('XML', 'RAW');

-- AlterTable
ALTER TABLE "Prompt" ADD COLUMN     "instructionFormat" "InstructionFormat" NOT NULL DEFAULT 'XML';
