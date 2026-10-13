-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('queued', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "ResultCategory" AS ENUM ('violation', 'incomplete', 'pass', 'inapplicable');

-- CreateEnum
CREATE TYPE "Impact" AS ENUM ('minor', 'moderate', 'serious', 'critical');

-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'queued',
    "wcagProfile" TEXT NOT NULL DEFAULT 'WCAG_2_2_AA',
    "config" JSONB NOT NULL,
    "engineName" TEXT,
    "engineVersion" TEXT,
    "browserVersion" TEXT,
    "rawResult" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "category" "ResultCategory" NOT NULL,
    "impact" "Impact",
    "help" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "helpUrl" TEXT NOT NULL,
    "tags" TEXT[],
    "wcagCriteria" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FindingNode" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "target" JSONB NOT NULL,
    "html" TEXT NOT NULL,
    "failureSummary" TEXT,
    "fingerprint" TEXT NOT NULL,

    CONSTRAINT "FindingNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Scan_projectId_createdAt_idx" ON "Scan"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Scan_status_createdAt_idx" ON "Scan"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Finding_scanId_category_idx" ON "Finding"("scanId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Finding_scanId_ruleId_category_key" ON "Finding"("scanId", "ruleId", "category");

-- CreateIndex
CREATE INDEX "FindingNode_findingId_idx" ON "FindingNode"("findingId");

-- CreateIndex
CREATE INDEX "FindingNode_fingerprint_idx" ON "FindingNode"("fingerprint");

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingNode" ADD CONSTRAINT "FindingNode_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
