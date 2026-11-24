-- CreateEnum
CREATE TYPE "ManualResult" AS ENUM ('pass', 'fail', 'not_applicable', 'cannot_determine');

-- AlterTable
ALTER TABLE "scans" ADD COLUMN     "page_facts" JSONB;

-- CreateTable
CREATE TABLE "manual_evaluations" (
    "id" TEXT NOT NULL,
    "scan_id" TEXT NOT NULL,
    "check_id" TEXT NOT NULL,
    "result" "ManualResult" NOT NULL,
    "evaluator" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "checks_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manual_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manual_evaluations_scan_id_check_id_key" ON "manual_evaluations"("scan_id", "check_id");

-- AddForeignKey
ALTER TABLE "manual_evaluations" ADD CONSTRAINT "manual_evaluations_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
