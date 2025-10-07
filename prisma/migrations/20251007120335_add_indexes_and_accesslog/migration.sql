/*
  Warnings:

  - You are about to drop the column `author` on the `Message` table. All the data in the column will be lost.
  - Made the column `sourceIp` on table `Message` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Message" DROP COLUMN "author",
ADD COLUMN     "name" TEXT NOT NULL DEFAULT 'Anonymous',
ALTER COLUMN "sourceIp" SET NOT NULL,
ALTER COLUMN "sourceIp" SET DEFAULT 'unknown';

-- CreateIndex
CREATE INDEX "AccessLog_path_idx" ON "AccessLog"("path");

-- CreateIndex
CREATE INDEX "Message_createdAt_id_idx" ON "Message"("createdAt", "id");
