-- AlterTable
ALTER TABLE "affected_elements" ADD COLUMN     "box_height" INTEGER,
ADD COLUMN     "box_width" INTEGER,
ADD COLUMN     "box_x" INTEGER,
ADD COLUMN     "box_y" INTEGER;

-- CreateTable
CREATE TABLE "scan_screenshots" (
    "scan_id" TEXT NOT NULL,
    "image" BYTEA NOT NULL,
    "format" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "page_height" INTEGER NOT NULL,
    "truncated" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_screenshots_pkey" PRIMARY KEY ("scan_id")
);

-- AddForeignKey
ALTER TABLE "scan_screenshots" ADD CONSTRAINT "scan_screenshots_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
