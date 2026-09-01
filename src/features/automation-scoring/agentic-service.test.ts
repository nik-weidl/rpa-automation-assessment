import { expect, test, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";

vi.mock("./openrouter", () => ({
  callOpenRouter: vi.fn(),
}));

import { evaluateActivityWithLLMAgentic } from "./agentic-service";
import { callOpenRouter } from "./openrouter";

let testLogId: string;
let testActivityId: string;

beforeAll(async () => {
  const log = await prisma.processLog.create({
    data: {
      name: "Test 6-Step Agentic Process Log",
      fileName: "agentic_6step_test.xes",
      fileSize: 1024,
      filePath: "/uploads/agentic_6step_test.xes",
      status: "PENDING",
    },
  });
  testLogId = log.id;

  const activity = await prisma.activity.create({
    data: {
      processLogId: testLogId,
      name: "Verify Invoice Details",
      frequency: 150,
      caseCoverage: 0.95,
      averageDuration: 120000,
      medianDuration: 110000,
      minDuration: 60000,
      maxDuration: 240000,
      resourceCount: 3,
      resources: ["UserA", "UserB", "UserC"],
      predecessors: ["Receive Invoice"],
      successors: ["Approve Payment"],
      durationVariance: 1440000000,
      resourceEntropy: 0.85,
      predecessorEntropy: 0.2,
      successorEntropy: 0.3,
    },
  });
  testActivityId = activity.id;
});

afterAll(async () => {
  if (testLogId) {
    await prisma.processLog.delete({
      where: { id: testLogId },
    });
  }
});

test("evaluateActivityWithLLMAgentic executes 6-step deep loop and returns archetype & effort tiers", async () => {
  const mockedCall = vi.mocked(callOpenRouter);

  // turn 1 mock: initial hypothesis & critique
  mockedCall.mockResolvedValueOnce({
    model: "~google/gemini-pro-latest",
    content: JSON.stringify({
      initialScore: 60,
      initialLabel: "MEDIUM",
      initialReasoning: "Standard invoice verification step, but system integrations may introduce manual checks.",
      selfCritique: "Need to verify if execution time variance and incoming path entropy indicate unpredictable routing.",
      requestedMetrics: ["durationVariance", "predecessorEntropy", "resourceCount"],
    }),
    latencyMs: 800,
    tokens: { prompt: 100, completion: 50, total: 150 },
    costUsd: 0.0005,
  });

  // turn 4 mock: archetype & effort classification
  mockedCall.mockResolvedValueOnce({
    model: "~google/gemini-pro-latest",
    content: JSON.stringify({
      rpaArchetype: "API_INTEGRATION",
      rpaArchetypeLabel: "API-Based Direct Integration",
      implementationEffort: "LOW",
      effortRationale: "ERP endpoint available.",
      estimatedMonthlyHoursSaved: 50,
    }),
    latencyMs: 600,
    tokens: { prompt: 150, completion: 60, total: 210 },
    costUsd: 0.0006,
  });

  // turn 5 mock: final synthesis
  mockedCall.mockResolvedValueOnce({
    model: "~google/gemini-pro-latest",
    content: JSON.stringify({
      score: 88,
      label: "HIGH",
      reasoning: "Retrieved metrics and neighbor context confirm low predecessor entropy (0.2) and API integration feasibility.",
      risks: ["OCR misreads on non-standard invoice formats"],
      missingInfo: ["Standard Operating Procedure for handling missing tax numbers"],
    }),
    latencyMs: 1200,
    tokens: { prompt: 250, completion: 90, total: 340 },
    costUsd: 0.0012,
  });

  const result = await evaluateActivityWithLLMAgentic(
    testActivityId,
    "~google/gemini-pro-latest"
  );

  expect(result).toBeDefined();
  expect(result.type).toBe("LLM_AGENTIC");
  expect(result.score).toBe(88);
  expect(result.label).toBe("HIGH");
  expect(result.latencyMs).toBe(2600); // 800 + 600 + 1200
  expect(result.costUsd).toBeCloseTo(0.0023);

  const raw = result.rawResponse as any;
  expect(raw).toBeDefined();
  expect(raw.initialScore).toBe(60);
  expect(raw.selfCritique).toContain("execution time variance");
  expect(raw.rpaArchetype).toBe("API_INTEGRATION");
  expect(raw.implementationEffort).toBe("LOW");
  expect(raw.thinkingTrace).toBeDefined();
  expect(Array.isArray(raw.thinkingTrace)).toBe(true);
  expect(raw.thinkingTrace.length).toBe(6);
});
