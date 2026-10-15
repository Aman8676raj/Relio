ALTER TABLE "contacts"
ADD COLUMN "inclusion_status" VARCHAR(32) NOT NULL DEFAULT 'active',
ADD COLUMN "exclusion_reason" VARCHAR(64);
