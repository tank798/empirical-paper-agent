const API_PROXY_TARGET =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (process.env.VERCEL ? "https://api-production-f140.up.railway.app/api" : "http://localhost:4000/api");

function buildUpstreamUrl(pathSegments: string[] | undefined, search: string) {
  const target = API_PROXY_TARGET.replace(/\/$/, "");
  const joinedPath = (pathSegments ?? []).join("/");
  return joinedPath ? target + "/" + joinedPath + search : target + search;
}

function createUpstreamHeaders(request: Request) {
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const projectToken = request.headers.get("x-project-token");
  const accept = request.headers.get("accept");

  if (contentType) {
    headers.set("content-type", contentType);
  }

  if (accept) {
    headers.set("accept", accept);
  }

  if (projectToken) {
    headers.set("x-project-token", projectToken);
  }

  return headers;
}

async function forwardRequest(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const params = await context.params;
  const method = request.method.toUpperCase();
  const upstreamUrl = buildUpstreamUrl(params.path, new URL(request.url).search);
  const body = method === "GET" || method === "HEAD" ? undefined : await request.text();

  const upstreamResponse = await fetch(upstreamUrl, {
    method,
    headers: createUpstreamHeaders(request),
    body,
    cache: "no-store"
  });

  const responseHeaders = new Headers();
  const contentType = upstreamResponse.headers.get("content-type");
  const cacheControl = upstreamResponse.headers.get("cache-control");

  if (contentType) {
    responseHeaders.set("content-type", contentType);
  }

  if (cacheControl) {
    responseHeaders.set("cache-control", cacheControl);
  }

  if (contentType?.includes("text/event-stream")) {
    responseHeaders.set("connection", "keep-alive");
    responseHeaders.set("x-accel-buffering", "no");
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders
  });
}

export {
  forwardRequest as GET,
  forwardRequest as POST,
  forwardRequest as PUT,
  forwardRequest as PATCH,
  forwardRequest as DELETE,
  forwardRequest as OPTIONS
};
