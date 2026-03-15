import { createHash, randomBytes } from "crypto";

export function generateResumeToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashResumeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeTitleFromTopic(topic: string): string {
  return topic.trim().slice(0, 60) || "Untitled Research Project";
}

export function buildDefaultExportFileName(title: string): string {
  const slug = title
    .replace(/[\\/:*?"<>|\s]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

  return `${slug || "regression_results"}.doc`;
}
