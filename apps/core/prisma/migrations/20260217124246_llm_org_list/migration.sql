-- CreateTable
CREATE TABLE "OrganizationDisabledModel" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "modelId" INTEGER NOT NULL,
    "disabledAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationDisabledModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationDisabledModel_organizationId_idx" ON "OrganizationDisabledModel"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationDisabledModel_modelId_idx" ON "OrganizationDisabledModel"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationDisabledModel_organizationId_modelId_key" ON "OrganizationDisabledModel"("organizationId", "modelId");

-- AddForeignKey
ALTER TABLE "OrganizationDisabledModel" ADD CONSTRAINT "OrganizationDisabledModel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationDisabledModel" ADD CONSTRAINT "OrganizationDisabledModel_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "LanguageModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
