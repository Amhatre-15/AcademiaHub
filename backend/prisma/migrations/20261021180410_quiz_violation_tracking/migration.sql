-- AlterTable
ALTER TABLE "quiz_attempts" ADD COLUMN     "last_violation_at" TIMESTAMP(3),
ADD COLUMN     "last_violation_type" TEXT,
ADD COLUMN     "violation_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "google_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "token_expiry" TIMESTAMP(3) NOT NULL,
    "google_email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_classroom_links" (
    "id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "subject_id" TEXT,
    "google_course_id" TEXT NOT NULL,
    "google_course_name" TEXT NOT NULL,
    "enrollment_code" TEXT,
    "section" TEXT,
    "alternate_link" TEXT,
    "linked_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_classroom_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "google_accounts_user_id_key" ON "google_accounts"("user_id");

-- CreateIndex
CREATE INDEX "google_accounts_user_id_idx" ON "google_accounts"("user_id");

-- CreateIndex
CREATE INDEX "google_classroom_links_class_id_idx" ON "google_classroom_links"("class_id");

-- CreateIndex
CREATE INDEX "google_classroom_links_subject_id_idx" ON "google_classroom_links"("subject_id");

-- CreateIndex
CREATE INDEX "google_classroom_links_google_course_id_idx" ON "google_classroom_links"("google_course_id");

-- CreateIndex
CREATE INDEX "google_classroom_links_enrollment_code_idx" ON "google_classroom_links"("enrollment_code");

-- CreateIndex
CREATE UNIQUE INDEX "google_classroom_links_class_id_subject_id_key" ON "google_classroom_links"("class_id", "subject_id");

-- AddForeignKey
ALTER TABLE "google_accounts" ADD CONSTRAINT "google_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_classroom_links" ADD CONSTRAINT "google_classroom_links_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_classroom_links" ADD CONSTRAINT "google_classroom_links_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
