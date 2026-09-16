-- CreateTable
CREATE TABLE "raw_events" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL,
    "source" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "app" TEXT,
    "window_title" TEXT,
    "url" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "raw_events_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "raw_events_device_id_timestamp_idx" ON "raw_events"("device_id", "timestamp");
-- CreateIndex
CREATE UNIQUE INDEX "raw_events_device_id_timestamp_source_key" ON "raw_events"("device_id", "timestamp", "source");
-- CreateIndex
CREATE UNIQUE INDEX "devices_user_id_name_key" ON "devices"("user_id", "name");
-- AddForeignKey
ALTER TABLE "raw_events" ADD CONSTRAINT "raw_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
