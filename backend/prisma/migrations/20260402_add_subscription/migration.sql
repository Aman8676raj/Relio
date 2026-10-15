-- Create enums
DO $$ BEGIN
  CREATE TYPE "Plan" AS ENUM ('free', 'pro', 'scale');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SubStatus" AS ENUM ('active', 'trialing', 'past_due', 'canceled', 'unpaid');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id"                     UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                UUID NOT NULL,
  "stripe_customer_id"     VARCHAR(255),
  "stripe_subscription_id" VARCHAR(255),
  "stripe_price_id"        VARCHAR(255),
  "plan"                   "Plan" NOT NULL DEFAULT 'free',
  "status"                 "SubStatus" NOT NULL DEFAULT 'active',
  "trial_ends_at"          TIMESTAMPTZ,
  "current_period_end"     TIMESTAMPTZ,
  "cancel_at_period_end"   BOOLEAN NOT NULL DEFAULT false,
  "created_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subscriptions_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "subscriptions_stripe_customer_id_key" UNIQUE ("stripe_customer_id"),
  CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions"("user_id");
