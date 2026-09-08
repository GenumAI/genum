-- PostgreSQL does not index foreign keys automatically, so each of these columns
-- was being scanned on a path the app hits constantly. Every index below is
-- justified by a query that exists today:
--
--   Prompt(projectId)             PromptsRepository.getProjectPrompts  -- the project page
--   TestCase(promptId, status)    the status histogram, now a single groupBy
--   PromptVersion(branchId)       every branches -> promptVersions include
--   TestcaseFile(testcaseId)      the files include on every testcase read
--   Placeholder(promptId)         PlaceholdersRepository.getPlaceholdersByPromptID
--                                 (@@unique([key, promptId]) cannot serve it -- promptId is not the leading column)
--   Project(organizationId)       project.findMany({ where: { organizationId } }), 3 call sites

-- CreateIndex
CREATE INDEX "Prompt_projectId_idx" ON "Prompt"("projectId");

-- CreateIndex
CREATE INDEX "PromptVersion_branchId_idx" ON "PromptVersion"("branchId");

-- CreateIndex
CREATE INDEX "TestCase_promptId_status_idx" ON "TestCase"("promptId", "status");

-- CreateIndex
CREATE INDEX "TestcaseFile_testcaseId_idx" ON "TestcaseFile"("testcaseId");

-- CreateIndex
CREATE INDEX "Placeholder_promptId_idx" ON "Placeholder"("promptId");

-- CreateIndex
CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");
