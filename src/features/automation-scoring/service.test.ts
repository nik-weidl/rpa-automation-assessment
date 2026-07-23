import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { evaluateActivityWithLLMSingleShot } from "./service";
import * as openrouter from "./openrouter";

// mock the OpenRouter client module
vi.mock("./openrouter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./openrouter")>();
  return {
    ...actual,
    callOpenRouter: vi.fn(),
  };
});

describe("evaluateActivityWithLLMSingleShot", () => {
  let testLogId: string;
  let testActivityId: string;

  beforeAll(async () => {
    // setup mock process log and activity in test database
    const log = await prisma.processLog.create({
      data: {
        name: "Test LLM Process",
        fileName: "test_llm.xes",
        fileSize: 512,
        filePath: "/uploads/test_llm.xes",
        status: "READY",
      },
    });
    testLogId = log.id;

    const activity = await prisma.activity.create({
      data: {
        processLogId: testLogId,
        name: "Approve Invoices",
        frequency: 500,
        caseCoverage: 0.95,
        averageDuration: 12000,
        minDuration: 2000,
        maxDuration: 45000,
        resourceCount: 3,
        resources: ["user_a", "user_b"],
        predecessors: ["Receive Invoices"],
        successors: ["Archive Invoices"],
        durationVariance: 1000000,
        resourceEntropy: 0.45,
        predecessorEntropy: 0.2,
        successorEntropy: 0.1,
      },
    });
    testActivityId = activity.id;
  });

  afterAll(async () => {
    // clean up database test records
    if (testLogId) {
      await prisma.processLog.delete({
        where: { id: testLogId },
      });
    }
  });

  it("should evaluate activity using LLM, parse response, and store to database", async () => {
    process.env.OPENROUTER_API_KEY = "test_key";

    // mock completion response
    vi.mocked(openrouter.callOpenRouter).mockResolvedValue({
      content: JSON.stringify({
        score: 82,
        label: "HIGH",
        reasoning: "Highly standardized step with low variation.",
        risks: ["compliance check bypass"],
        missingInfo: ["obtain pricing catalog details"],
      }),
      tokens: {
        prompt: 120,
        completion: 45,
        total: 165,
      },
      costUsd: 0.0025,
      latencyMs: 850,
      model: "~google/gemini-pro-latest",
    });

    // trigger service call
    const result = await evaluateActivityWithLLMSingleShot(
      testActivityId,
      "~google/gemini-pro-latest"
    );

    // verify database insertion
    expect(result.activityId).toBe(testActivityId);
    expect(result.score).toBe(82);
    expect(result.label).toBe("HIGH");
    expect(result.reasoning).toBe("Highly standardized step with low variation.");
    expect(result.risks).toEqual(["compliance check bypass"]);
    expect(result.missingInfo).toEqual(["obtain pricing catalog details"]);
    expect(result.costUsd).toBe(0.0025);
    expect(result.latencyMs).toBe(850);
    expect(result.model).toBe("~google/gemini-pro-latest");

    // verify duplicate assessment records are cleared on subsequent call
    vi.mocked(openrouter.callOpenRouter).mockResolvedValue({
      content: JSON.stringify({
        score: 85,
        label: "HIGH",
        reasoning: "Updated evaluation.",
        risks: [],
        missingInfo: [],
      }),
      tokens: { prompt: 100, completion: 30, total: 130 },
      costUsd: 0.0018,
      latencyMs: 700,
      model: "~google/gemini-pro-latest",
    });

    const secondResult = await evaluateActivityWithLLMSingleShot(
      testActivityId,
      "~google/gemini-pro-latest"
    );

    expect(secondResult.score).toBe(85);

    // verify only one assessment exists in database for this type and model
    const dbAssessments = await prisma.assessment.findMany({
      where: {
        activityId: testActivityId,
        type: "LLM_SINGLE_SHOT",
        model: "~google/gemini-pro-latest",
      },
    });

    expect(dbAssessments.length).toBe(1);
  });
});
