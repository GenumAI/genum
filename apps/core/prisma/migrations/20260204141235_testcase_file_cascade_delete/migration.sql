-- DropForeignKey
ALTER TABLE "TestcaseFile" DROP CONSTRAINT "TestcaseFile_fileId_fkey";

-- DropForeignKey
ALTER TABLE "TestcaseFile" DROP CONSTRAINT "TestcaseFile_testcaseId_fkey";

-- AddForeignKey
ALTER TABLE "TestcaseFile" ADD CONSTRAINT "TestcaseFile_testcaseId_fkey" FOREIGN KEY ("testcaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestcaseFile" ADD CONSTRAINT "TestcaseFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
