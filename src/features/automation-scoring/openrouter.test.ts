import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { callOpenRouter } from "./openrouter";

describe("callOpenRouter", () => {
  const originalEnv = process.env;
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  it("should throw an error if OPENROUTER_API_KEY is not defined", async () => {
    delete process.env.OPENROUTER_API_KEY;

    await expect(
      callOpenRouter("google/gemini-2.5-pro", "system", "user")
    ).rejects.toThrow("missing OpenRouter API key");
  });

  it("should return completion results, latency, and token counts when API calls succeed", async () => {
    process.env.OPENROUTER_API_KEY = "test_key";

    // mock completion response (no generation ID for cost request)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: null,
        choices: [
          {
            message: {
              content: "hello world response",
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      }),
    });

    const result = await callOpenRouter("google/gemini-2.5-pro", "system", "user");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.content).toBe("hello world response");
    expect(result.tokens.prompt).toBe(10);
    expect(result.tokens.completion).toBe(5);
    expect(result.tokens.total).toBe(15);
    expect(result.costUsd).toBeNull();
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.model).toBe("google/gemini-2.5-pro");
  });

  it("should call generation stats endpoint and return cost when generation ID is returned", async () => {
    process.env.OPENROUTER_API_KEY = "test_key";

    // mock completion response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "gen-12345",
        choices: [
          {
            message: {
              content: "hello world response with cost",
            },
          },
        ],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 10,
          total_tokens: 30,
        },
      }),
    });

    // mock cost query response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          cost: 0.0045,
        },
      }),
    });

    const result = await callOpenRouter("google/gemini-2.5-pro", "system", "user");

    expect(mockFetch).toHaveBeenCalledTimes(2);
    // verify correct requests were made
    const firstCallUrl = mockFetch.mock.calls[0][0];
    const secondCallUrl = mockFetch.mock.calls[1][0];
    expect(firstCallUrl).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(secondCallUrl).toBe("https://openrouter.ai/api/v1/generation?id=gen-12345");

    expect(result.content).toBe("hello world response with cost");
    expect(result.costUsd).toBe(0.0045);
  });

  it("should throw an error on API failure status code", async () => {
    process.env.OPENROUTER_API_KEY = "test_key";

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized API key",
    });

    await expect(
      callOpenRouter("google/gemini-2.5-pro", "system", "user")
    ).rejects.toThrow("OpenRouter API error (status 401): Unauthorized API key");
  });

  it("should fallback gracefully and return null cost if generation cost fetch fails", async () => {
    process.env.OPENROUTER_API_KEY = "test_key";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "gen-12345",
        choices: [{ message: { content: "ok" } }],
      }),
    });

    // mock cost query returning 500 error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = await callOpenRouter("google/gemini-2.5-pro", "system", "user");

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.content).toBe("ok");
    expect(result.costUsd).toBeNull(); // fallback value
  });
});
