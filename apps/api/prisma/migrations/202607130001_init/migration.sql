CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "AnomalyConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
CREATE TYPE "IdempotencyStatus" AS ENUM ('PENDING', 'COMPLETED');

CREATE TABLE "User" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Category" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "type" "TransactionType" NOT NULL,
  "color" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Transaction" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "categoryId" UUID NOT NULL,
  "type" "TransactionType" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "description" VARCHAR(240),
  "transactionDate" TIMESTAMPTZ(3) NOT NULL,
  "anomalyScore" INTEGER,
  "anomalyConfidence" "AnomalyConfidence",
  "anomalyVersion" TEXT,
  "anomalyAnalysis" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Transaction_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "Transaction_currency_inr" CHECK ("currency" = 'INR')
);

CREATE TABLE "IdempotencyRecord" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "key" UUID NOT NULL,
  "operation" VARCHAR(80) NOT NULL,
  "requestHash" CHAR(64) NOT NULL,
  "status" "IdempotencyStatus" NOT NULL DEFAULT 'PENDING',
  "transactionId" UUID,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "transactionId" UUID,
  "eventType" VARCHAR(80) NOT NULL,
  "severity" "NotificationSeverity" NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "body" VARCHAR(500) NOT NULL,
  "readAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Category_userId_slug_key" ON "Category"("userId", "slug");
CREATE INDEX "Category_userId_type_isActive_idx" ON "Category"("userId", "type", "isActive");
CREATE INDEX "Transaction_userId_transactionDate_idx" ON "Transaction"("userId", "transactionDate" DESC);
CREATE INDEX "Transaction_userId_type_transactionDate_idx" ON "Transaction"("userId", "type", "transactionDate" DESC);
CREATE INDEX "Transaction_userId_categoryId_transactionDate_idx" ON "Transaction"("userId", "categoryId", "transactionDate" DESC);
CREATE UNIQUE INDEX "IdempotencyRecord_transactionId_key" ON "IdempotencyRecord"("transactionId");
CREATE UNIQUE INDEX "IdempotencyRecord_userId_key_operation_key" ON "IdempotencyRecord"("userId", "key", "operation");
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt" DESC);

ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
