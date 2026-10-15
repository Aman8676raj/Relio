/*
  Warnings:

  - You are about to drop the `subscriptions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_user_id_fkey";

-- AlterTable
ALTER TABLE "intro_paths" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pipeline_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferences" JSONB NOT NULL DEFAULT '{}';

-- DropTable
DROP TABLE IF EXISTS "subscriptions";

-- DropEnum
DROP TYPE IF EXISTS "Plan";

-- DropEnum
DROP TYPE IF EXISTS "SubStatus";

-- CreateTable
CREATE TABLE "investor_records" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "fund_name" VARCHAR(255),
    "fund_size_usd" BIGINT,
    "fund_vintage_year" INTEGER,
    "investor_type" VARCHAR(50),
    "stage_focus" TEXT[],
    "sector_focus" TEXT[],
    "geography" TEXT[],
    "typical_check_min_usd" INTEGER,
    "typical_check_max_usd" INTEGER,
    "linkedin_url" TEXT,
    "twitter_handle" VARCHAR(100),
    "website" TEXT,
    "photo_url" TEXT,
    "thesis_raw" TEXT,
    "thesis_summary" TEXT,
    "recent_investments" JSONB,
    "investment_count_18mo" INTEGER NOT NULL DEFAULT 0,
    "last_known_investment_date" DATE,
    "is_actively_deploying" BOOLEAN NOT NULL DEFAULT true,
    "crunchbase_id" VARCHAR(100),
    "data_quality_score" INTEGER NOT NULL DEFAULT 0,
    "last_enriched_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "investor_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "startup_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(255),
    "stage" VARCHAR(50),
    "sector" VARCHAR(100),
    "sub_sector" VARCHAR(100),
    "arr_usd" INTEGER,
    "geography" VARCHAR(100),
    "raise_target_usd" INTEGER,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "startup_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_scores" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "investor_record_id" UUID NOT NULL,
    "portfolio_fit_score" INTEGER,
    "thesis_alignment_score" INTEGER,
    "fund_deployment_status" VARCHAR(20),
    "warm_path_score" INTEGER,
    "warm_path_summary" TEXT,
    "composite_score" INTEGER NOT NULL DEFAULT 0,
    "thesis_alignment_reason" TEXT,
    "last_scored_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "discovery_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "steps" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence_enrollments" (
    "id" UUID NOT NULL,
    "sequence_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "enrolled_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "next_send_at" TIMESTAMPTZ,
    "replied_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sequence_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence_emails" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "step_number" INTEGER NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "generated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMPTZ,
    "sent_at" TIMESTAMPTZ,
    "opened_at" TIMESTAMPTZ,
    "gmail_message_id" VARCHAR(255),

    CONSTRAINT "sequence_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecast_snapshots" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "snapshot_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "target_raise_usd" INTEGER,
    "committed_usd" INTEGER NOT NULL DEFAULT 0,
    "pipeline_value_usd" INTEGER NOT NULL DEFAULT 0,
    "close_probability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "projected_close_date" DATE,
    "meetings_needed_per_week" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "current_velocity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "on_track" BOOLEAN NOT NULL DEFAULT false,
    "stage_conversion_rates" JSONB NOT NULL DEFAULT '{}',
    "avg_days_per_stage" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forecast_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sentiment_snapshots" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "snapshot_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avg_reply_latency_hours" DOUBLE PRECISION,
    "avg_reply_length_words" DOUBLE PRECISION,
    "forward_looking_score" DOUBLE PRECISION,
    "question_specificity_score" DOUBLE PRECISION,
    "proactive_reach_out_count" INTEGER NOT NULL DEFAULT 0,
    "degrading_signals" TEXT[],
    "alert_triggered" BOOLEAN NOT NULL DEFAULT false,
    "llm_raw_analysis" TEXT,
    "recommended_action" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sentiment_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sentiment_alerts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "snapshot_id" UUID NOT NULL,
    "alert_type" VARCHAR(50) NOT NULL,
    "summary" TEXT NOT NULL,
    "recommended_action" TEXT,
    "dismissed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sentiment_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_briefs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "calendar_event_id" VARCHAR(255) NOT NULL,
    "meeting_at" TIMESTAMPTZ NOT NULL,
    "brief_markdown" TEXT,
    "generated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_email_at" TIMESTAMPTZ,
    "viewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_briefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostics_reports" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "report_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dropout_by_stage" JSONB NOT NULL DEFAULT '{}',
    "top_dropout_topics" JSONB NOT NULL DEFAULT '[]',
    "high_performing_phrases" JSONB NOT NULL DEFAULT '[]',
    "low_performing_phrases" JSONB NOT NULL DEFAULT '[]',
    "velocity_trend" VARCHAR(20) NOT NULL DEFAULT 'stable',
    "narrative_summary" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnostics_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_members" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'contributor',
    "invited_by" UUID,
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_notes" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contact_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_feed" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "contact_id" UUID,
    "activity_type" VARCHAR(50) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_feed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pitch_decks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "org_id" UUID,
    "filename" VARCHAR(255) NOT NULL,
    "storage_url" TEXT NOT NULL,
    "page_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pitch_decks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deck_shares" (
    "id" UUID NOT NULL,
    "deck_id" UUID NOT NULL,
    "contact_id" UUID,
    "share_token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deck_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deck_views" (
    "id" UUID NOT NULL,
    "share_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "pages_viewed" INTEGER[],
    "time_per_page" JSONB NOT NULL DEFAULT '{}',
    "viewer_ip" VARCHAR(50),

    CONSTRAINT "deck_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "investor_records_investor_type_idx" ON "investor_records"("investor_type");

-- CreateIndex
CREATE INDEX "investor_records_is_actively_deploying_idx" ON "investor_records"("is_actively_deploying");

-- CreateIndex
CREATE INDEX "investor_records_fund_name_idx" ON "investor_records"("fund_name");

-- CreateIndex
CREATE UNIQUE INDEX "startup_profiles_user_id_key" ON "startup_profiles"("user_id");

-- CreateIndex
CREATE INDEX "discovery_scores_user_id_composite_score_idx" ON "discovery_scores"("user_id", "composite_score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "discovery_scores_user_id_investor_record_id_key" ON "discovery_scores"("user_id", "investor_record_id");

-- CreateIndex
CREATE INDEX "sequences_user_id_status_idx" ON "sequences"("user_id", "status");

-- CreateIndex
CREATE INDEX "sequence_enrollments_status_next_send_at_idx" ON "sequence_enrollments"("status", "next_send_at");

-- CreateIndex
CREATE UNIQUE INDEX "sequence_enrollments_sequence_id_contact_id_key" ON "sequence_enrollments"("sequence_id", "contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "sequence_emails_enrollment_id_step_number_key" ON "sequence_emails"("enrollment_id", "step_number");

-- CreateIndex
CREATE INDEX "forecast_snapshots_user_id_snapshot_date_idx" ON "forecast_snapshots"("user_id", "snapshot_date" DESC);

-- CreateIndex
CREATE INDEX "sentiment_snapshots_user_id_contact_id_snapshot_at_idx" ON "sentiment_snapshots"("user_id", "contact_id", "snapshot_at" DESC);

-- CreateIndex
CREATE INDEX "sentiment_alerts_user_id_dismissed_at_idx" ON "sentiment_alerts"("user_id", "dismissed_at");

-- CreateIndex
CREATE INDEX "sentiment_alerts_contact_id_created_at_idx" ON "sentiment_alerts"("contact_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "meeting_briefs_user_id_meeting_at_idx" ON "meeting_briefs"("user_id", "meeting_at");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_briefs_user_id_calendar_event_id_key" ON "meeting_briefs"("user_id", "calendar_event_id");

-- CreateIndex
CREATE INDEX "diagnostics_reports_user_id_report_date_idx" ON "diagnostics_reports"("user_id", "report_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "org_members_org_id_user_id_key" ON "org_members"("org_id", "user_id");

-- CreateIndex
CREATE INDEX "contact_notes_contact_id_created_at_idx" ON "contact_notes"("contact_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activity_feed_org_id_created_at_idx" ON "activity_feed"("org_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activity_feed_org_id_contact_id_idx" ON "activity_feed"("org_id", "contact_id");

-- CreateIndex
CREATE INDEX "pitch_decks_user_id_created_at_idx" ON "pitch_decks"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "deck_shares_share_token_key" ON "deck_shares"("share_token");

-- CreateIndex
CREATE INDEX "deck_shares_deck_id_idx" ON "deck_shares"("deck_id");

-- CreateIndex
CREATE INDEX "deck_views_share_id_started_at_idx" ON "deck_views"("share_id", "started_at" DESC);

-- AddForeignKey
ALTER TABLE "startup_profiles" ADD CONSTRAINT "startup_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_scores" ADD CONSTRAINT "discovery_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_scores" ADD CONSTRAINT "discovery_scores_investor_record_id_fkey" FOREIGN KEY ("investor_record_id") REFERENCES "investor_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_sequence_id_fkey" FOREIGN KEY ("sequence_id") REFERENCES "sequences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_emails" ADD CONSTRAINT "sequence_emails_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "sequence_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_snapshots" ADD CONSTRAINT "forecast_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sentiment_snapshots" ADD CONSTRAINT "sentiment_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sentiment_snapshots" ADD CONSTRAINT "sentiment_snapshots_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sentiment_alerts" ADD CONSTRAINT "sentiment_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sentiment_alerts" ADD CONSTRAINT "sentiment_alerts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sentiment_alerts" ADD CONSTRAINT "sentiment_alerts_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "sentiment_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_briefs" ADD CONSTRAINT "meeting_briefs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_briefs" ADD CONSTRAINT "meeting_briefs_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostics_reports" ADD CONSTRAINT "diagnostics_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_notes" ADD CONSTRAINT "contact_notes_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_notes" ADD CONSTRAINT "contact_notes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pitch_decks" ADD CONSTRAINT "pitch_decks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pitch_decks" ADD CONSTRAINT "pitch_decks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deck_shares" ADD CONSTRAINT "deck_shares_deck_id_fkey" FOREIGN KEY ("deck_id") REFERENCES "pitch_decks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deck_views" ADD CONSTRAINT "deck_views_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "deck_shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'uq_intro_path' AND relkind = 'i') THEN
    ALTER INDEX "uq_intro_path" RENAME TO "intro_paths_user_id_source_contact_id_target_contact_id_key";
  END IF;
END $$;
