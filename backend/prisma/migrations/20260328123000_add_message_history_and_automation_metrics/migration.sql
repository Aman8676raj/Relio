CREATE TYPE "MessageDirection" AS ENUM ('inbound', 'outbound');
CREATE TYPE "ParticipantRole" AS ENUM ('from', 'to', 'cc', 'bcc');

ALTER TABLE "contacts"
ADD COLUMN "is_manual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "inbound_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "outbound_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "reply_rate_30d" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN "reply_rate_90d" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN "reply_rate_180d" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN "avg_response_hours_30d" DOUBLE PRECISION,
ADD COLUMN "avg_response_hours_90d" DOUBLE PRECISION,
ADD COLUMN "avg_response_hours_180d" DOUBLE PRECISION,
ADD COLUMN "messages_last_30d" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "messages_last_90d" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "messages_last_180d" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "conversation_days_30d" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "conversation_days_90d" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "conversation_days_180d" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "last_inbound_at" TIMESTAMPTZ,
ADD COLUMN "last_outbound_at" TIMESTAMPTZ;

CREATE TABLE "email_messages" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "gmail_message_id" VARCHAR(255) NOT NULL,
    "gmail_thread_id" VARCHAR(255) NOT NULL,
    "subject" TEXT,
    "snippet" TEXT,
    "body_text" TEXT,
    "from_email" VARCHAR(255) NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "in_reply_to" VARCHAR(255),
    "sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_message_participants" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "role" "ParticipantRole" NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_message_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contact_warmth_snapshots" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "recorded_on" DATE NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "tier" "WarmthTier" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contact_warmth_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_messages_user_id_gmail_message_id_key"
ON "email_messages"("user_id", "gmail_message_id");

CREATE INDEX "email_messages_user_id_sent_at_idx"
ON "email_messages"("user_id", "sent_at");

CREATE INDEX "email_messages_user_id_gmail_thread_id_idx"
ON "email_messages"("user_id", "gmail_thread_id");

CREATE INDEX "email_message_participants_message_id_role_idx"
ON "email_message_participants"("message_id", "role");

CREATE INDEX "email_message_participants_user_id_email_idx"
ON "email_message_participants"("user_id", "email");

CREATE UNIQUE INDEX "contact_warmth_snapshots_contact_id_recorded_on_key"
ON "contact_warmth_snapshots"("contact_id", "recorded_on");

CREATE INDEX "contact_warmth_snapshots_user_id_recorded_on_idx"
ON "contact_warmth_snapshots"("user_id", "recorded_on");

ALTER TABLE "email_messages"
ADD CONSTRAINT "email_messages_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_message_participants"
ADD CONSTRAINT "email_message_participants_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_message_participants"
ADD CONSTRAINT "email_message_participants_message_id_fkey"
FOREIGN KEY ("message_id") REFERENCES "email_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact_warmth_snapshots"
ADD CONSTRAINT "contact_warmth_snapshots_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact_warmth_snapshots"
ADD CONSTRAINT "contact_warmth_snapshots_contact_id_fkey"
FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
