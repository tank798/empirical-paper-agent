import type { ApiResponse, WorkflowStreamEvent } from "@empirical/shared";

const API_BASE_URL = "/api/proxy";

function createHeaders(options: RequestInit & { token?: string }) {
  const headers = new Headers(options.headers ?? {});
  headers.set("Content-Type", "application/json");

  if (options.token) {
    headers.set("x-project-token", options.token);
  }

  return headers;
}

function getApiErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const data = payload as Partial<ApiResponse<unknown>> & {
    error?: { message?: string } | string | null;
    message?: string;
  };

  const rawMessage =
    typeof data.error === "string"
      ? data.error
      : data.error?.message ?? (typeof data.message === "string" ? data.message : "");

  if (/application not found/i.test(rawMessage)) {
    return "API 服务当前不可用：Railway 后端没有运行或已被停用。";
  }

  if (/trial has expired/i.test(rawMessage)) {
    return "API 服务当前不可用：Railway 试用期已过期，需要升级或迁移后端。";
  }

  return rawMessage || fallback;
}

function flushSseBuffer(buffer: string, onEvent: (event: WorkflowStreamEvent) => void) {
  let remaining = buffer;

  while (true) {
    const separatorIndex = remaining.indexOf("\n\n");
    if (separatorIndex < 0) {
      return remaining;
    }

    const rawBlock = remaining.slice(0, separatorIndex);
    remaining = remaining.slice(separatorIndex + 2);

    const data = rawBlock
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n")
      .trim();

    if (!data) {
      continue;
    }

    onEvent(JSON.parse(data) as WorkflowStreamEvent);
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const headers = createHeaders(options);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store"
  });
  const text = await response.text();
  let json: unknown = null;

  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(text || `Request failed with status ${response.status}`);
    }
  }

  if (!response.ok) {
    throw new Error(getApiErrorMessage(json, `Request failed with status ${response.status}`));
  }

  const apiJson = json as ApiResponse<T>;

  if (!apiJson?.success) {
    throw new Error(getApiErrorMessage(apiJson, "Request failed"));
  }

  return apiJson.data;
}

export async function streamApiRequest(
  path: string,
  options: {
    body: Record<string, unknown>;
    token?: string;
    signal?: AbortSignal;
    onEvent: (event: WorkflowStreamEvent) => void;
  }
) {
  const headers = createHeaders({ token: options.token });
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(options.body),
    cache: "no-store",
    signal: options.signal
  });

  if (!response.ok) {
    const text = await response.text();
    let errorMessage = text || `Request failed with status ${response.status}`;

    try {
      errorMessage = getApiErrorMessage(JSON.parse(text), errorMessage);
    } catch {
      // Keep the plain-text fallback.
    }

    throw new Error(errorMessage);
  }

  if (!response.body) {
    throw new Error("Streaming is not available in this environment.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    buffer = flushSseBuffer(buffer, options.onEvent);
  }

  buffer += decoder.decode();
  flushSseBuffer(buffer, options.onEvent);
}

export { API_BASE_URL };
