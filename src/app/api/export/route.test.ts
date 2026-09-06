import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";

describe("GET /api/export", () => {
  let createdLogId: string;

  beforeEach(async () => {
    // Create dummy process log with activity and assessment
    const log = await prisma.processLog.create({
      data: {
        name: "Test Benchmark Log",
        fileName: "test_benchmark.xes",
        fileSize: 1024,
        filePath: "/tmp/test.xes",
        status: "READY",
        activities: {
          create: {
            name: "Review Application",
            frequency: 45,
            caseCoverage: 0.9,
            averageDuration: 120.5,
            medianDuration: 100.0,
            minDuration: 30.0,
            maxDuration: 500.0,
            resourceCount: 3,
            durationVariance: 15.2,
            resourceEntropy: 0.8,
            predecessorEntropy: 0.5,
            successorEntropy: 0.6,
          },
        },
      },
      include: {
        activities: true,
      },
    });
    createdLogId = log.id;

    const activity = log.activities[0];

    await prisma.assessment.create({
      data: {
        processLogId: log.id,
        activityId: activity.id,
        type: "RULE_BASED",
        model: "rule-engine-v1",
        score: 85,
        label: "HIGH",
        reasoning: "High standardization and high frequency.",
        risks: ["Low human interaction variance"],
        missingInfo: ["System API endpoints"],
        latencyMs: 12,
        costUsd: 0.0,
      },
    });
  });

  afterEach(async () => {
    if (createdLogId) {
      await prisma.processLog.delete({ where: { id: createdLogId } }).catch(() => {});
    }
  });

  it("exports benchmark data as CSV format", async () => {
    const req = new Request("http://localhost:3000/api/export?format=csv");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("rpa_assessment_all_logs_");

    const text = await res.text();
    expect(text).toContain("ProcessLogId,ProcessLogName");
    expect(text).toContain("Test Benchmark Log");
    expect(text).toContain("Review Application");
    expect(text).toContain("HIGH");
  });

  it("exports benchmark data as JSON format", async () => {
    const req = new Request("http://localhost:3000/api/export?format=json");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");

    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
    const targetLog = json.find((l: any) => l.id === createdLogId);
    expect(targetLog).toBeDefined();
    expect(targetLog.name).toBe("Test Benchmark Log");
    expect(targetLog.activities[0].name).toBe("Review Application");
    expect(targetLog.activities[0].assessments[0].score).toBe(85);
  });
});
