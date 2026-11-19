-- CreateTable
CREATE TABLE "scan_layouts" (
    "scan_id" TEXT NOT NULL,
    "widths" INTEGER[],
    "breakpoints" JSONB NOT NULL,
    "meta_viewport" TEXT,
    "duration_ms" INTEGER NOT NULL,
    "partial" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_layouts_pkey" PRIMARY KEY ("scan_id")
);

-- CreateTable
CREATE TABLE "layout_issues" (
    "id" TEXT NOT NULL,
    "scan_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "width_min" INTEGER,
    "width_max" INTEGER,
    "elements" JSONB NOT NULL,
    "details" JSONB NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "image" BYTEA,
    "image_format" TEXT,
    "image_width" INTEGER,
    "image_height" INTEGER,
    "image_viewport" INTEGER,
    "boxes" JSONB NOT NULL,

    CONSTRAINT "layout_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "layout_issues_scan_id_idx" ON "layout_issues"("scan_id");

-- AddForeignKey
ALTER TABLE "scan_layouts" ADD CONSTRAINT "scan_layouts_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "layout_issues" ADD CONSTRAINT "layout_issues_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scan_layouts"("scan_id") ON DELETE CASCADE ON UPDATE CASCADE;
