// supported models list for frontend UI selection
export const SUPPORTED_MODELS = [
  { id: "~google/gemini-pro-latest", name: "Gemini Pro (Latest)" },
  { id: "~google/gemini-flash-latest", name: "Gemini Flash (Latest)" },
  { id: "~anthropic/claude-sonnet-latest", name: "Claude Sonnet (Latest)" },
  { id: "~openai/gpt-latest", name: "GPT (Latest)" },
  { id: "~openai/gpt-mini-latest", name: "GPT Mini (Latest)" },
];

export interface OpenRouterResponse {
  content: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  costUsd: number | null;
  latencyMs: number;
  model: string;
}

export type ResponseFormatOption =
  | { type: "json_object" }
  | {
      type: "json_schema";
      json_schema: {
        name: string;
        strict: boolean;
        schema: Record<string, any>;
      };
    };

export interface OpenRouterOptions {
  responseFormat?: ResponseFormatOption;
  temperature?: number;
  seed?: number;
  signal?: AbortSignal;
}

/**
 * calls OpenRouter API to fetch completion results with cost and latency tracking
 */
export async function callOpenRouter(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  optionsOrFormat?: ResponseFormatOption | OpenRouterOptions,
  legacyTemperature: number = 0.1
): Promise<OpenRouterResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("missing OpenRouter API key. please configure OPENROUTER_API_KEY in your env.");
  }

  let responseFormat: ResponseFormatOption | undefined;
  let temperature = 0.0; // Set temperature to 0.0 (greedy decoding) for 100% deterministic assessment scores
  let seed: number | undefined = 42; // Fixed seed for identical batch vs single activity evaluations
  let signal: AbortSignal | undefined;

  if (optionsOrFormat) {
    if ("type" in optionsOrFormat) {
      responseFormat = optionsOrFormat as ResponseFormatOption;
    } else {
      const opts = optionsOrFormat as OpenRouterOptions;
      responseFormat = opts.responseFormat;
      if (opts.temperature !== undefined) temperature = opts.temperature;
      if (opts.seed !== undefined) seed = opts.seed;
      if (opts.signal !== undefined) signal = opts.signal;
    }
  }

  const startTime = Date.now();

  // make the primary chat completion request
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Agentic RPA Assessment Tool",
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      ...(seed !== undefined ? { seed } : {}),
      ...(responseFormat ? { response_format: responseFormat } : {}),
    }),
  });

  // handle non-200 responses
  if (!response.ok) {
    const errText = await response.text().catch(() => "unknown API error");
    throw new Error(`OpenRouter API error (status ${response.status}): ${errText}`);
  }

  const data = await response.json();
  const latencyMs = Date.now() - startTime;

  const content = data.choices?.[0]?.message?.content || "";
  const promptTokens = data.usage?.prompt_tokens || 0;
  const completionTokens = data.usage?.completion_tokens || 0;
  const totalTokens = data.usage?.total_tokens || 0;
  const generationId = data.id;

  let costUsd: number | null = null;

  // fetch actual generation cost if generation ID exists
  if (generationId) {
    try {
      const statsResponse = await fetch(`https://openrouter.ai/api/v1/generation?id=${generationId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        // extract cost from OpenRouter statistics response (total_cost or cost)
        const reportedCost = statsData?.data?.total_cost ?? statsData?.data?.cost;
        if (typeof reportedCost === "number") {
          costUsd = reportedCost;
        }
      }
    } catch (statsError) {
      // log generation stats failure without breaking the flow
      console.warn("failed to fetch generation cost from OpenRouter:", statsError);
    }
  }

  return {
    content,
    tokens: {
      prompt: promptTokens,
      completion: completionTokens,
      total: totalTokens,
    },
    costUsd,
    latencyMs,
    model,
  };
}
