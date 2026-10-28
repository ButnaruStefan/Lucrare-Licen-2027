-- CreateTable
CREATE TABLE "legal_profiles" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "framework" TEXT NOT NULL DEFAULT 'RO_OUG_112_2018',
    "answers" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "assessment" JSONB NOT NULL,
    "catalog_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "legal_profiles_project_id_key" ON "legal_profiles"("project_id");

-- AddForeignKey
ALTER TABLE "legal_profiles" ADD CONSTRAINT "legal_profiles_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
