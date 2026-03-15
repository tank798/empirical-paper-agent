const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  headers.set("Content-Type", "application/json");
  if (options.token) {
    headers.set("x-project-token", options.token);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store"
  });
  const json = (await response.json()) as { success: boolean; data: T; error: { message: string } | null };
  if (!json.success) {
    throw new Error(json.error?.message ?? "Request failed");
  }

  return json.data;
}

export { API_BASE_URL };
