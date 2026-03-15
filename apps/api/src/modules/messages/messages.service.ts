import { Injectable } from "@nestjs/common";
import { AssistantMessageType, WorkflowStep } from "@empirical/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async createMessage(input: {
    projectId: string;
    role: "user" | "assistant" | "system";
    messageType: string;
    step?: WorkflowStep | null;
    contentText?: string | null;
    contentJson: Record<string, unknown>;
  }) {
    const message = await this.prisma.message.create({
      data: {
        projectId: input.projectId,
        role: input.role,
        messageType: input.messageType,
        step: input.step ?? null,
        contentText: input.contentText ?? null,
        contentJson: input.contentJson as never
      }
    });

    return {
      id: message.id,
      projectId: message.projectId,
      role: message.role as "user" | "assistant" | "system",
      messageType: message.messageType as
        | (typeof AssistantMessageType)[keyof typeof AssistantMessageType]
        | string,
      step: (message.step as WorkflowStep | null) ?? null,
      contentText: message.contentText,
      contentJson: (message.contentJson as Record<string, unknown>) ?? {},
      createdAt: message.createdAt.toISOString()
    };
  }

  async getProjectMessages(projectId: string) {
    const messages = await this.prisma.message.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" }
    });

    return messages.map((message) => ({
      id: message.id,
      projectId: message.projectId,
      role: message.role as "user" | "assistant" | "system",
      messageType: message.messageType,
      step: (message.step as WorkflowStep | null) ?? null,
      contentText: message.contentText,
      contentJson: (message.contentJson as Record<string, unknown>) ?? {},
      createdAt: message.createdAt.toISOString()
    }));
  }

  async getRecentMessages(projectId: string, limit = 12) {
    const messages = await this.prisma.message.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: limit
    });

    return messages.reverse().map((message) => ({
      role: message.role,
      messageType: message.messageType,
      step: message.step,
      contentText: message.contentText,
      contentJson: (message.contentJson as Record<string, unknown>) ?? {}
    }));
  }
}
