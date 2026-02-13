-- AlterTable
ALTER TABLE "Call" ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "expiresAt_idx" ON "Call"("expiresAt");
