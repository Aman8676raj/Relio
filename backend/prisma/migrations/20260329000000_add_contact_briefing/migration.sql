-- CreateTable
CREATE TABLE "contact_briefings" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "summary" TEXT NOT NULL,
    "key_facts" TEXT[],
    "open_questions" TEXT[],
    "commitments" JSONB NOT NULL DEFAULT '[]',
    "sentiment" VARCHAR(20) NOT NULL DEFAULT 'neutral',
    "last_meeting_mentioned" TEXT,
    "thread_hash_key" VARCHAR(64) NOT NULL,
    "generated_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contact_briefings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contact_briefings_contact_id_key" ON "contact_briefings"("contact_id");

-- CreateIndex
CREATE INDEX "contact_briefings_user_id_idx" ON "contact_briefings"("user_id");

-- AddForeignKey
ALTER TABLE "contact_briefings" ADD CONSTRAINT "contact_briefings_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_briefings" ADD CONSTRAINT "contact_briefings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
