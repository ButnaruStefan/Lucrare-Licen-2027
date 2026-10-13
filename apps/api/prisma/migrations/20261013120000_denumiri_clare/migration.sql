-- Migrație scrisă manual: REDENUMEȘTE tabelele, coloanele, tipurile și indexurile la nume
-- clare, în stilul snake_case (ex. "Finding" -> "rule_results", "baseUrl" -> "base_url").
-- Folosim RENAME, nu DROP + CREATE, ca datele existente (proiectele) să nu se piardă.

-- 1. Tipurile enum
ALTER TYPE "ScanStatus" RENAME TO "scan_status";
ALTER TYPE "ResultCategory" RENAME TO "result_category";
ALTER TYPE "Impact" RENAME TO "impact";

-- 2. Tabelul proiectelor
ALTER TABLE "Project" RENAME TO "projects";
ALTER TABLE "projects" RENAME COLUMN "baseUrl" TO "base_url";
ALTER TABLE "projects" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "projects" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "projects" RENAME CONSTRAINT "Project_pkey" TO "projects_pkey";

-- 3. Tabelul scanărilor
ALTER TABLE "Scan" RENAME TO "scans";
ALTER TABLE "scans" RENAME COLUMN "projectId" TO "project_id";
ALTER TABLE "scans" RENAME COLUMN "url" TO "page_url";
ALTER TABLE "scans" RENAME COLUMN "wcagProfile" TO "wcag_profile";
ALTER TABLE "scans" RENAME COLUMN "engineName" TO "engine_name";
ALTER TABLE "scans" RENAME COLUMN "engineVersion" TO "engine_version";
ALTER TABLE "scans" RENAME COLUMN "browserVersion" TO "browser_version";
ALTER TABLE "scans" RENAME COLUMN "rawResult" TO "raw_axe_result";
ALTER TABLE "scans" RENAME COLUMN "errorCode" TO "error_code";
ALTER TABLE "scans" RENAME COLUMN "errorMessage" TO "error_message";
ALTER TABLE "scans" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "scans" RENAME COLUMN "startedAt" TO "started_at";
ALTER TABLE "scans" RENAME COLUMN "finishedAt" TO "finished_at";
ALTER TABLE "scans" RENAME CONSTRAINT "Scan_pkey" TO "scans_pkey";
ALTER TABLE "scans" RENAME CONSTRAINT "Scan_projectId_fkey" TO "scans_project_id_fkey";
ALTER INDEX "Scan_projectId_createdAt_idx" RENAME TO "scans_project_id_created_at_idx";
ALTER INDEX "Scan_status_createdAt_idx" RENAME TO "scans_status_created_at_idx";

-- 4. Rezultatele pe reguli (fostul "Finding")
ALTER TABLE "Finding" RENAME TO "rule_results";
ALTER TABLE "rule_results" RENAME COLUMN "scanId" TO "scan_id";
ALTER TABLE "rule_results" RENAME COLUMN "ruleId" TO "axe_rule_id";
ALTER TABLE "rule_results" RENAME COLUMN "help" TO "title";
ALTER TABLE "rule_results" RENAME COLUMN "helpUrl" TO "docs_url";
ALTER TABLE "rule_results" RENAME COLUMN "tags" TO "axe_tags";
ALTER TABLE "rule_results" RENAME COLUMN "wcagCriteria" TO "wcag_criteria";
ALTER TABLE "rule_results" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "rule_results" RENAME CONSTRAINT "Finding_pkey" TO "rule_results_pkey";
ALTER TABLE "rule_results" RENAME CONSTRAINT "Finding_scanId_fkey" TO "rule_results_scan_id_fkey";
ALTER INDEX "Finding_scanId_category_idx" RENAME TO "rule_results_scan_id_category_idx";
ALTER INDEX "Finding_scanId_ruleId_category_key" RENAME TO "rule_results_scan_id_axe_rule_id_category_key";

-- 5. Elementele afectate (fostul "FindingNode")
ALTER TABLE "FindingNode" RENAME TO "affected_elements";
ALTER TABLE "affected_elements" RENAME COLUMN "findingId" TO "rule_result_id";
ALTER TABLE "affected_elements" RENAME COLUMN "target" TO "css_selector";
ALTER TABLE "affected_elements" RENAME COLUMN "html" TO "html_snippet";
ALTER TABLE "affected_elements" RENAME COLUMN "failureSummary" TO "failure_summary";
ALTER TABLE "affected_elements" RENAME CONSTRAINT "FindingNode_pkey" TO "affected_elements_pkey";
ALTER TABLE "affected_elements" RENAME CONSTRAINT "FindingNode_findingId_fkey" TO "affected_elements_rule_result_id_fkey";
ALTER INDEX "FindingNode_findingId_idx" RENAME TO "affected_elements_rule_result_id_idx";
ALTER INDEX "FindingNode_fingerprint_idx" RENAME TO "affected_elements_fingerprint_idx";
