-- CreateEnum
CREATE TYPE "WarmthTier" AS ENUM ('hot', 'warm', 'cold', 'frozen');

-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('none', 'intro', 'meeting', 'dd', 'term_sheet');

-- CreateEnum
CREATE TYPE "DraftFeedback" AS ENUM ('positive', 'negative');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "google_access_token" TEXT,
    "google_refresh_token" TEXT,
    "token_expiry" TIMESTAMPTZ,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "last_sync_at" TIMESTAMPTZ,
    "sync_cursor" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "company" VARCHAR(255),
    "first_contacted_at" TIMESTAMPTZ,
    "last_contacted_at" TIMESTAMPTZ,
    "total_emails" INTEGER NOT NULL DEFAULT 0,
    "reply_rate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "avg_thread_depth" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "warmth_score" DOUBLE PRECISION DEFAULT 0.0,
    "warmth_tier" "WarmthTier" NOT NULL DEFAULT 'frozen',
    "warmth_score_previous" DOUBLE PRECISION,
    "warmth_tier_override" "WarmthTier",
    "warmth_updated_at" TIMESTAMPTZ,
    "pipeline_stage" "PipelineStage" NOT NULL DEFAULT 'none',
    "pipeline_updated_at" TIMESTAMPTZ,
    "notes" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_threads" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "gmail_thread_id" VARCHAR(255) NOT NULL,
    "subject" TEXT,
    "message_count" INTEGER NOT NULL DEFAULT 1,
    "last_message_at" TIMESTAMPTZ,
    "snippet" TEXT,
    "full_content" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "email_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drafts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "thread_context_ids" UUID[],
    "prompt_version" VARCHAR(50),
    "generated_text" TEXT,
    "edited_text" TEXT,
    "final_sent_text" TEXT,
    "feedback" "DraftFeedback",
    "was_sent" BOOLEAN NOT NULL DEFAULT false,
    "gmail_message_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digest_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "contacts_suggested" UUID[],
    "email_sent_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "digest_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "contacts_user_id_last_contacted_at_idx" ON "contacts"("user_id", "last_contacted_at");

-- CreateIndex
CREATE INDEX "contacts_user_id_warmth_tier_last_contacted_at_idx" ON "contacts"("user_id", "warmth_tier", "last_contacted_at");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_user_id_email_key" ON "contacts"("user_id", "email");

-- CreateIndex
CREATE INDEX "email_threads_contact_id_last_message_at_idx" ON "email_threads"("contact_id", "last_message_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "email_threads_user_id_gmail_thread_id_key" ON "email_threads"("user_id", "gmail_thread_id");

-- CreateIndex
CREATE INDEX "drafts_user_id_contact_id_created_at_idx" ON "drafts"("user_id", "contact_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "digest_logs_user_id_email_sent_at_idx" ON "digest_logs"("user_id", "email_sent_at");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digest_logs" ADD CONSTRAINT "digest_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
