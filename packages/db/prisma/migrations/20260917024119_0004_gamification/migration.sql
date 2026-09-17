-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL,
    "ended_at" TIMESTAMPTZ NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "app" TEXT,
    "window_title" TEXT,
    "category" TEXT NOT NULL,
    "sub_category" TEXT,
    "source" TEXT NOT NULL,
    "app_minutes" JSONB,
    "intentionality_score" DOUBLE PRECISION DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "pending" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_state" (
    "user_id" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "streak_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_state_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "xp_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL,
    "amount" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "stat_affected" TEXT,
    "source_ref" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "progress" JSONB,
    "reward_xp" INTEGER NOT NULL,
    "period_start" TIMESTAMPTZ NOT NULL,
    "period_end" TIMESTAMPTZ,
    "completed_at" TIMESTAMP(3),
    "reward_given" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unlocked_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessions_device_id_started_at_idx" ON "sessions"("device_id", "started_at");

-- CreateIndex
CREATE INDEX "sessions_device_id_status_idx" ON "sessions"("device_id", "status");

-- CreateIndex
CREATE INDEX "sessions_category_idx" ON "sessions"("category");

-- CreateIndex
CREATE INDEX "sessions_device_id_idx" ON "sessions"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_device_id_started_at_key" ON "sessions"("device_id", "started_at");

-- CreateIndex
CREATE INDEX "xp_log_user_id_timestamp_idx" ON "xp_log"("user_id", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "xp_log_user_id_source_ref_key" ON "xp_log"("user_id", "source_ref");

-- CreateIndex
CREATE INDEX "quests_user_id_status_idx" ON "quests"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "quests_user_id_key_period_start_key" ON "quests"("user_id", "key", "period_start");

-- CreateIndex
CREATE INDEX "achievements_user_id_idx" ON "achievements"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_user_id_key_key" ON "achievements"("user_id", "key");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_state" ADD CONSTRAINT "user_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_log" ADD CONSTRAINT "xp_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quests" ADD CONSTRAINT "quests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
