import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { promptManifest, type PromptSkillName } from "@empirical/prompts";
import * as fs from "fs/promises";
import * as nodeFs from "fs";
import * as path from "path";

@Injectable()
export class PromptService {
  private promptsRoot: string | null = null;
  private systemPromptCache: string | null = null;
  private skillPromptCache = new Map<
    PromptSkillName,
    {
      version: string;
      template: string;
    }
  >();

  constructor(private readonly configService: ConfigService) {}

  async getSystemPrompt() {
    if (this.systemPromptCache) {
      return this.systemPromptCache;
    }

    const root = this.resolvePromptsRoot();
    this.systemPromptCache = await fs.readFile(path.join(root, promptManifest.system.file), "utf8");
    return this.systemPromptCache;
  }

  async getSkillPrompt(skillName: PromptSkillName) {
    const cached = this.skillPromptCache.get(skillName);
    if (cached) {
      return cached;
    }

    const root = this.resolvePromptsRoot();
    const manifest = promptManifest.skills[skillName];
    const template = await fs.readFile(path.join(root, manifest.file), "utf8");
    const prompt = {
      version: manifest.version,
      template
    };
    this.skillPromptCache.set(skillName, prompt);

    return prompt;
  }

  renderPrompt(template: string, input: unknown) {
    return template.replace("{{input}}", JSON.stringify(input));
  }

  private resolvePromptsRoot() {
    if (this.promptsRoot) {
      return this.promptsRoot;
    }

    const configured = this.configService.get<string>("PROMPTS_DIR");
    const candidates = [
      configured,
      path.resolve(process.cwd(), "packages/prompts"),
      path.resolve(process.cwd(), "../../packages/prompts"),
      path.resolve(__dirname, "../../../../../packages/prompts")
    ].filter(Boolean) as string[];

    const existing = candidates.find((candidate) => nodeFs.existsSync(candidate));
    if (!existing) {
      throw new Error("Unable to resolve prompts directory");
    }

    this.promptsRoot = existing;
    return existing;
  }
}
