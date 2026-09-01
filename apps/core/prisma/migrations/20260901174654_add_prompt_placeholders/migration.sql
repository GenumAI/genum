-- AlterTable
ALTER TABLE "PromptVersion" ADD COLUMN     "placeholders" JSONB;

-- CreateTable
CREATE TABLE "Placeholder" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "promptId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Placeholder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaceholderValue" (
    "id" SERIAL NOT NULL,
    "placeholderId" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaceholderValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCasePlaceholderValue" (
    "testCaseId" INTEGER NOT NULL,
    "placeholderId" INTEGER NOT NULL,
    "placeholderValueId" INTEGER NOT NULL,

    CONSTRAINT "TestCasePlaceholderValue_pkey" PRIMARY KEY ("testCaseId","placeholderValueId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Placeholder_key_promptId_key" ON "Placeholder"("key", "promptId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaceholderValue_placeholderId_name_key" ON "PlaceholderValue"("placeholderId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TestCasePlaceholderValue_testCaseId_placeholderId_key" ON "TestCasePlaceholderValue"("testCaseId", "placeholderId");

-- AddForeignKey
ALTER TABLE "Placeholder" ADD CONSTRAINT "Placeholder_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "Prompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceholderValue" ADD CONSTRAINT "PlaceholderValue_placeholderId_fkey" FOREIGN KEY ("placeholderId") REFERENCES "Placeholder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCasePlaceholderValue" ADD CONSTRAINT "TestCasePlaceholderValue_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCasePlaceholderValue" ADD CONSTRAINT "TestCasePlaceholderValue_placeholderValueId_fkey" FOREIGN KEY ("placeholderValueId") REFERENCES "PlaceholderValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- At most one default value per placeholder.
CREATE UNIQUE INDEX "PlaceholderValue_one_default_per_placeholder"
    ON "PlaceholderValue" ("placeholderId")
    WHERE "isDefault";
