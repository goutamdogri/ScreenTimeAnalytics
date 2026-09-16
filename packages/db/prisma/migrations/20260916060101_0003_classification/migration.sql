-- AlterTable
ALTER TABLE "raw_events" ADD COLUMN     "category" TEXT,
ADD COLUMN     "sub_category" TEXT;

-- CreateTable
CREATE TABLE "llm_config" (
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "encrypted_api_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_config_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "classification_cache" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sub_category" TEXT,
    "method" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classification_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "classification_cache_url_key" ON "classification_cache"("url");

-- CreateIndex
CREATE INDEX "raw_events_category_idx" ON "raw_events"("category");

-- AddForeignKey
ALTER TABLE "llm_config" ADD CONSTRAINT "llm_config_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
