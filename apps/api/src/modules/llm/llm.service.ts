import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type LlmProfileName = "default" | "fast" | "code" | "reasoning";

type LlmProfileConfig = {
  model: string;
  timeoutMs: number;
  useResponseFormat: boolean;
  enableThinking: boolean | null;
  maxTokens: number | null;
  temperature: number;
};

export type GenerateJsonOptions = {
  profile?: LlmProfileName;
  model?: string;
  timeoutMs?: number;
  useResponseFormat?: boolean;
  enableThinking?: boolean | null;
  maxTokens?: number | null;
  temperature?: number;
};

export type GenerateJsonResult = {
  data: Record<string, unknown>;
  model: string;
  profile: LlmProfileName;
  timeoutMs: number;
  maxTokens: number | null;
};

function parseBoolean(value: string | undefined, defaultValue: boolean) {
  if (value == null || value.trim() === "") {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parseOptionalBoolean(value: string | undefined) {
  if (value == null || value.trim() === "") {
    return null;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parseOptionalNumber(value: string | undefined) {
  if (value == null || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseJsonObject(content: string) {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("The model returned empty content.");
  }

  const withoutFences = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const candidates = [withoutFences];
  const firstBrace = withoutFences.indexOf("{");
  const lastBrace = withoutFences.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(withoutFences.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error("The model response was not a valid JSON object.");
}

function extractErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const data = payload as Record<string, unknown>;
  if (typeof data.message === "string") {
    return data.message;
  }

  if (data.error && typeof data.error === "object" && data.error !== null) {
    const errorData = data.error as Record<string, unknown>;
    if (typeof errorData.message === "string") {
      return errorData.message;
    }
  }

  return fallback;
}

function supportsThinkingControl(baseURL: string, model: string) {
  if (!baseURL.includes("siliconflow.cn")) {
    return false;
  }

  return model.startsWith("Qwen/") || model.includes("GLM-5");
}

@Injectable()
export class LlmService {
  private readonly apiKey: string | null;
  private readonly baseURL: string;
  private readonly model: string;
  private readonly profiles: Record<LlmProfileName, LlmProfileConfig>;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>("OPENAI_API_KEY") ?? null;
    this.baseURL = this.configService.get<string>("OPENAI_BASE_URL") ?? "https://api.openai.com/v1";
    this.model = this.configService.get<string>("OPENAI_MODEL") ?? "gpt-4.1-mini";

    const defaultTimeout = parseOptionalNumber(this.configService.get<string>("OPENAI_TIMEOUT_MS")) ?? 60000;
    const defaultUseResponseFormat = parseBoolean(
      this.configService.get<string>("OPENAI_USE_RESPONSE_FORMAT"),
      false
    );
    const configuredThinking = parseOptionalBoolean(this.configService.get<string>("OPENAI_ENABLE_THINKING"));
    const defaultEnableThinking =
      configuredThinking ??
      (supportsThinkingControl(this.baseURL, this.model) ? false : null);
    const defaultMaxTokens =
      parseOptionalNumber(this.configService.get<string>("OPENAI_MAX_TOKENS")) ??
      (this.baseURL.includes("siliconflow.cn") ? 1024 : null);

    this.profiles = {
      default: {
        model: this.model,
        timeoutMs: defaultTimeout,
        useResponseFormat: defaultUseResponseFormat,
        enableThinking: defaultEnableThinking,
        maxTokens: defaultMaxTokens,
        temperature: 0.2
      },
      fast: {
        model: this.configService.get<string>("OPENAI_FAST_MODEL") ?? this.model,
        timeoutMs:
          parseOptionalNumber(this.configService.get<string>("OPENAI_FAST_TIMEOUT_MS")) ??
          Math.min(defaultTimeout, 30000),
        useResponseFormat: defaultUseResponseFormat,
        enableThinking: supportsThinkingControl(this.baseURL, this.configService.get<string>("OPENAI_FAST_MODEL") ?? this.model)
          ? false
          : null,
        maxTokens: parseOptionalNumber(this.configService.get<string>("OPENAI_FAST_MAX_TOKENS")) ?? 512,
        temperature: 0.1
      },
      code: {
        model: this.configService.get<string>("OPENAI_CODE_MODEL") ?? this.model,
        timeoutMs:
          parseOptionalNumber(this.configService.get<string>("OPENAI_CODE_TIMEOUT_MS")) ??
          Math.min(defaultTimeout, 45000),
        useResponseFormat: defaultUseResponseFormat,
        enableThinking: supportsThinkingControl(this.baseURL, this.configService.get<string>("OPENAI_CODE_MODEL") ?? this.model)
          ? false
          : null,
        maxTokens: parseOptionalNumber(this.configService.get<string>("OPENAI_CODE_MAX_TOKENS")) ?? 900,
        temperature: 0.1
      },
      reasoning: {
        model: this.configService.get<string>("OPENAI_REASONING_MODEL") ?? this.model,
        timeoutMs:
          parseOptionalNumber(this.configService.get<string>("OPENAI_REASONING_TIMEOUT_MS")) ?? defaultTimeout,
        useResponseFormat: defaultUseResponseFormat,
        enableThinking:
          parseOptionalBoolean(this.configService.get<string>("OPENAI_REASONING_ENABLE_THINKING")) ??
          defaultEnableThinking,
        maxTokens:
          parseOptionalNumber(this.configService.get<string>("OPENAI_REASONING_MAX_TOKENS")) ??
          defaultMaxTokens ??
          1200,
        temperature: 0.2
      }
    };
  }

  get isConfigured() {
    return Boolean(this.apiKey);
  }

  get modelName() {
    return this.model;
  }

  async generateJson(
    systemPrompt: string,
    userPrompt: string,
    options: GenerateJsonOptions = {}
  ): Promise<GenerateJsonResult> {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const resolved = this.resolveConfig(options);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), resolved.timeoutMs);

    try {
      const requestBody: Record<string, unknown> = {
        model: resolved.model,
        temperature: resolved.temperature,
        stream: false,
        messages: [
          {
            role: "system",
            content: `${systemPrompt}\n\nReturn only a valid JSON object. Do not add markdown fences or extra commentary.`
          },
          { role: "user", content: userPrompt }
        ]
      };

      if (resolved.useResponseFormat) {
        requestBody.response_format = { type: "json_object" };
      }

      if (resolved.enableThinking !== null) {
        requestBody.enable_thinking = resolved.enableThinking;
      }

      if (resolved.maxTokens !== null) {
        requestBody.max_tokens = resolved.maxTokens;
      }

      const response = await fetch(`${this.baseURL.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      const text = await response.text();
      const payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, `LLM request failed with status ${response.status}`));
      }

      const content =
        ((payload.choices as Array<Record<string, unknown>> | undefined)?.[0]?.message as Record<
          string,
          unknown
        > | undefined)?.content;

      if (typeof content !== "string") {
        throw new Error("The model response did not include assistant content.");
      }

      return {
        data: parseJsonObject(content),
        model: resolved.model,
        profile: resolved.profile,
        timeoutMs: resolved.timeoutMs,
        maxTokens: resolved.maxTokens
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`LLM request timed out after ${resolved.timeoutMs}ms`);
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private resolveConfig(options: GenerateJsonOptions) {
    const profileName = options.profile ?? "default";
    const base = this.profiles[profileName] ?? this.profiles.default;

    return {
      profile: profileName,
      model: options.model ?? base.model,
      timeoutMs: options.timeoutMs ?? base.timeoutMs,
      useResponseFormat: options.useResponseFormat ?? base.useResponseFormat,
      enableThinking: options.enableThinking ?? base.enableThinking,
      maxTokens: options.maxTokens ?? base.maxTokens,
      temperature: options.temperature ?? base.temperature
    };
  }
}
