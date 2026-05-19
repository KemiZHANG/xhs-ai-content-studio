import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OneClickResult } from "@/lib/workflows/one-click";

export type StoredChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  workflowResult?: OneClickResult;
};

export type ChatConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredChatMessage[];
};

type AppendChatTurnInput = {
  conversationId?: string | null;
  userContent: string;
  assistantContent: string;
  workflowResult?: OneClickResult;
};

const MAX_CONVERSATIONS = 60;
const MAX_MESSAGES_PER_CONVERSATION = 120;

const chatHistoryPath = () => path.join(process.cwd(), "data", "chat-history.json");

export async function listChatConversations(): Promise<ChatConversation[]> {
  return readConversations();
}

export async function getChatConversation(id: string): Promise<ChatConversation | null> {
  const conversations = await readConversations();
  return conversations.find((conversation) => conversation.id === id) ?? null;
}

export async function appendChatTurn(input: AppendChatTurnInput): Promise<ChatConversation> {
  const conversations = await readConversations();
  const now = new Date().toISOString();
  const existing = input.conversationId
    ? conversations.find((conversation) => conversation.id === input.conversationId)
    : undefined;

  const baseConversation: ChatConversation =
    existing ??
    {
      id: `chat-${Date.now()}-${randomUUID().slice(0, 8)}`,
      title: makeTitle(input.userContent),
      createdAt: now,
      updatedAt: now,
      messages: []
    };

  const newMessages: StoredChatMessage[] = [
    {
      id: `msg-${randomUUID()}`,
      role: "user",
      content: input.userContent,
      createdAt: now
    },
    {
      id: `msg-${randomUUID()}`,
      role: "assistant",
      content: input.assistantContent,
      createdAt: now,
      workflowResult: input.workflowResult
    }
  ];

  const nextConversation: ChatConversation = {
    ...baseConversation,
    updatedAt: now,
    messages: [...baseConversation.messages, ...newMessages].slice(-MAX_MESSAGES_PER_CONVERSATION)
  };

  const nextConversations = [
    nextConversation,
    ...conversations.filter((conversation) => conversation.id !== nextConversation.id)
  ].slice(0, MAX_CONVERSATIONS);

  await writeConversations(nextConversations);
  return nextConversation;
}

async function readConversations(): Promise<ChatConversation[]> {
  try {
    const raw = await readFile(chatHistoryPath(), "utf8");
    const parsed = JSON.parse(raw) as ChatConversation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeConversations(conversations: ChatConversation[]): Promise<void> {
  const filePath = chatHistoryPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(conversations, null, 2)}\n`, "utf8");
}

function makeTitle(content: string): string {
  const compact = content.replace(/\s+/g, " ").trim();
  return compact.length > 28 ? `${compact.slice(0, 28)}...` : compact || "新对话";
}
