-- CreateEnum
CREATE TYPE "audit_status" AS ENUM ('discovery_queued', 'discovering', 'awaiting_selection', 'scanning', 'failed');

-- AlterTable
ALTER TABLE "scans" ADD COLUMN     "audit_id" TEXT;

-- CreateTable
CREATE TABLE "audits" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "start_url" TEXT NOT NULL,
    "max_pages" INTEGER NOT NULL,
    "status" "audit_status" NOT NULL DEFAULT 'discovery_queued',
    "config" JSONB NOT NULL,
    "catalog_version" TEXT NOT NULL,
    "discovery" JSONB,
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discovery_started_at" TIMESTAMP(3),
    "discovered_at" TIMESTAMP(3),
    "selected_at" TIMESTAMP(3),

    CONSTRAINT "audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audits_project_id_created_at_idx" ON "audits"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "audits_status_created_at_idx" ON "audits"("status", "created_at");

-- CreateIndex
CREATE INDEX "scans_audit_id_idx" ON "scans"("audit_id");

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
