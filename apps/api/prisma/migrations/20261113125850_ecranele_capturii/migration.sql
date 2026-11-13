-- AlterTable
ALTER TABLE "scan_screenshots" ADD COLUMN     "frame_height" INTEGER,
ADD COLUMN     "frame_offsets" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
