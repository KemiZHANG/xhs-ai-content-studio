import { NextResponse } from "next/server";
import { getChatConversation, listChatConversations } from "@/lib/storage/chat";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id) {
    const conversation = await getChatConversation(id);
    return NextResponse.json({ conversation });
  }

  const conversations = await listChatConversations();
  return NextResponse.json({ conversations });
}
