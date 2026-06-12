import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

type JsonBodyRequest = {
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  readableEnded?: boolean;
  setEncoding: (encoding: BufferEncoding) => void;
  on: (event: "data" | "end" | "error", listener: (chunkOrError?: unknown) => void) => void;
};

type JsonBodyResponse = {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

function jsonBodyFallback(request: JsonBodyRequest, response: JsonBodyResponse, next: (error?: unknown) => void) {
  const contentType = request.headers["content-type"];
  const normalizedContentType = Array.isArray(contentType) ? contentType.join(";") : contentType ?? "";
  const method = request.method?.toUpperCase();

  if (
    request.body !== undefined ||
    request.readableEnded ||
    method === "GET" ||
    method === "HEAD" ||
    !normalizedContentType.includes("application/json")
  ) {
    next();
    return;
  }

  let rawBody = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => {
    rawBody += String(chunk ?? "");
  });
  request.on("end", () => {
    if (!rawBody.trim()) {
      next();
      return;
    }

    try {
      request.body = JSON.parse(rawBody) as unknown;
      next();
    } catch {
      response.status(400).json({
        message: "Invalid JSON body",
        error: "Bad Request",
        statusCode: 400
      });
    }
  });
  request.on("error", (error) => next(error));
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.use(jsonBodyFallback);
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: process.env.WEB_ORIGIN?.split(",") ?? ["http://localhost:3000"],
    credentials: true
  });
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
}

void bootstrap();
