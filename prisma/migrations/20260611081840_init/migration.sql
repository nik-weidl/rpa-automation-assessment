-- CreateEnum
CREATE TYPE "LogStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'ERROR');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('RULE_BASED', 'LLM_SINGLE_SHOT', 'LLM_AGENTIC');

-- CreateEnum
CREATE TYPE "AutomationLabel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "ProcessLog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "status" "LogStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trace" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "processLogId" TEXT NOT NULL,

    CONSTRAINT "Trace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "resource" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "processLogId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL,
    "caseCoverage" DOUBLE PRECISION NOT NULL,
    "averageDuration" DOUBLE PRECISION NOT NULL,
    "minDuration" DOUBLE PRECISION NOT NULL,
    "maxDuration" DOUBLE PRECISION NOT NULL,
    "resourceCount" INTEGER NOT NULL,
    "resources" TEXT[],
    "predecessors" TEXT[],
    "successors" TEXT[],
    "durationVariance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resourceEntropy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "predecessorEntropy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "successorEntropy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "processLogId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "type" "AssessmentType" NOT NULL DEFAULT 'RULE_BASED',
    "model" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "label" "AutomationLabel" NOT NULL,
    "reasoning" TEXT NOT NULL,
    "risks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "missingInfo" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "latencyMs" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Trace_processLogId_idx" ON "Trace"("processLogId");

-- CreateIndex
CREATE INDEX "Event_traceId_idx" ON "Event"("traceId");

-- CreateIndex
CREATE INDEX "Activity_processLogId_idx" ON "Activity"("processLogId");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_processLogId_name_key" ON "Activity"("processLogId", "name");

-- CreateIndex
CREATE INDEX "Assessment_activityId_idx" ON "Assessment"("activityId");

-- CreateIndex
CREATE INDEX "Assessment_processLogId_idx" ON "Assessment"("processLogId");

-- AddForeignKey
ALTER TABLE "Trace" ADD CONSTRAINT "Trace_processLogId_fkey" FOREIGN KEY ("processLogId") REFERENCES "ProcessLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_traceId_fkey" FOREIGN KEY ("traceId") REFERENCES "Trace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_processLogId_fkey" FOREIGN KEY ("processLogId") REFERENCES "ProcessLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_processLogId_fkey" FOREIGN KEY ("processLogId") REFERENCES "ProcessLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
