-- Add terminal pipeline stages
ALTER TYPE "PipelineStage" ADD VALUE IF NOT EXISTS 'closed_won';
ALTER TYPE "PipelineStage" ADD VALUE IF NOT EXISTS 'closed_lost';
ALTER TYPE "PipelineStage" ADD VALUE IF NOT EXISTS 'paused';

-- Pipeline events audit trail
CREATE TABLE "pipeline_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "from_stage" "PipelineStage" NOT NULL,
    "to_stage" "PipelineStage" NOT NULL,
    "trigger" VARCHAR(20) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pipeline_events_contact_id_created_at_idx" ON "pipeline_events"("contact_id", "created_at" DESC);

ALTER TABLE "pipeline_events" ADD CONSTRAINT "pipeline_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pipeline_events" ADD CONSTRAINT "pipeline_events_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Intro paths
CREATE TABLE "intro_paths" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "source_contact_id" UUID NOT NULL,
    "target_contact_id" UUID NOT NULL,
    "strength_score" DOUBLE PRECISION NOT NULL,
    "shared_thread_count" INTEGER NOT NULL DEFAULT 0,
    "reasoning" TEXT NOT NULL,
    "computed_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intro_paths_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_intro_path" ON "intro_paths"("user_id", "source_contact_id", "target_contact_id");
CREATE INDEX "intro_paths_user_id_strength_score_idx" ON "intro_paths"("user_id", "strength_score" DESC);

ALTER TABLE "intro_paths" ADD CONSTRAINT "intro_paths_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
