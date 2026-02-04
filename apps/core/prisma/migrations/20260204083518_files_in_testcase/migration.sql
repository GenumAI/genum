-- CreateTable
CREATE TABLE "TestcaseFile" (
    "id" SERIAL NOT NULL,
    "testcaseId" INTEGER NOT NULL,
    "fileId" TEXT NOT NULL,

    CONSTRAINT "TestcaseFile_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TestcaseFile" ADD CONSTRAINT "TestcaseFile_testcaseId_fkey" FOREIGN KEY ("testcaseId") REFERENCES "TestCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestcaseFile" ADD CONSTRAINT "TestcaseFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
