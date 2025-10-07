-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "author" TEXT,
    "content" TEXT NOT NULL,
    "sourceIp" TEXT,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "path" TEXT NOT NULL,
    "remoteIp" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "authUser" TEXT,
    "status" INTEGER NOT NULL,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessLog_ts_idx" ON "AccessLog"("ts");

-- CreateIndex
CREATE INDEX "AccessLog_remoteIp_idx" ON "AccessLog"("remoteIp");
