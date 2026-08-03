import { NextRequest, NextResponse } from 'next/server';
import { createServices, createChatbotService } from '@/lib/services';
import { getSession } from '@/domain/auth';
import { z } from 'zod';
import type { ChatMessage } from '@/domain/chatbot';

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(500),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    timestamp: z.string(),
  })).max(50).default([]),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid chat request.', details: parsed.error.format() }, { status: 400 });
    }

    const session = await getSession();
    const userId = session?.sub ?? 'anonymous';

    const services = createServices();
    const chatbotService = createChatbotService(services);
    const response = await chatbotService.respond(userId, parsed.data.message, parsed.data.history as ChatMessage[]);

    return NextResponse.json({ response });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Chat request failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
