/*
  Warnings:

  - A unique constraint covering the columns `[vendor,name,apiKeyId]` on the table `LanguageModel` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "AiVendor" ADD VALUE 'CUSTOM_OPENAI_COMPATIBLE';

-- DropIndex
DROP INDEX "LanguageModel_vendor_name_key";

-- AlterTable
ALTER TABLE "LanguageModel" ADD COLUMN     "apiKeyId" INTEGER;

-- AlterTable
ALTER TABLE "OrganizationApiKey" ADD COLUMN     "baseUrl" VARCHAR(512),
ADD COLUMN     "name" VARCHAR(255);

-- CreateIndex
CREATE INDEX "LanguageModel_apiKeyId_idx" ON "LanguageModel"("apiKeyId");

-- CreateIndex
CREATE UNIQUE INDEX "LanguageModel_vendor_name_apiKeyId_key" ON "LanguageModel"("vendor", "name", "apiKeyId");

-- AddForeignKey
ALTER TABLE "LanguageModel" ADD CONSTRAINT "LanguageModel_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "OrganizationApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
