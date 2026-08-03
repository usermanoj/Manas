import type { ModelGateway, ModelGatewayContext } from '@/domain/ai';
import type { AuditLogger } from '@/domain/audit';
import { z } from 'zod';

export interface ChatbotServiceDeps {
  modelGateway?: ModelGateway;
  auditLogger: AuditLogger;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatbotResponse {
  content: string;
  mood: 'understanding' | 'reassuring' | 'encouraging' | 'reflective';
}

export const ChatbotResponseSchema = z.object({
  content: z.string().min(1).max(800),
  mood: z.enum(['understanding', 'reassuring', 'encouraging', 'reflective']),
});

const QUICK_REPLIES = [
  'What happens to my data?',
  'How do I connect with a professional?',
  'Can I delete my check-in?',
  'Is this an emergency service?',
  'What can Manus help me with?',
];

const RESPONSE_MAP: Record<string, ChatbotResponse> = {
  'what happens to my data?': {
    content: "Your privacy matters to me. Your check-in conversations are stored only for your session and shown to you in the Privacy page. You can view, edit, exclude, or delete anything at any time. We do not use your private conversations to train models, and we do not share them without your explicit consent.",
    mood: 'reassuring',
  },
  'how do i connect with a professional?': {
    content: "After you complete a check-in and confirm your summary, you can browse the Professionals directory. Each profile shows pricing, focus areas, and availability. When you're ready, you can start a consent-controlled handoff.",
    mood: 'understanding',
  },
  'can i delete my check-in?': {
    content: "Yes. Visit the Privacy page to see your check-in sessions and delete any of them. Deleting creates an audit event so you have a transparent record of what happened.",
    mood: 'encouraging',
  },
  'is this an emergency service?': {
    content: "No, Manas is not an emergency service. If you are in crisis or feel unsafe, please contact your local emergency services or a crisis helpline right away. I'm here for everyday reflection and support, not immediate intervention.",
    mood: 'reassuring',
  },
  'what can manus help me with?': {
    content: "I can guide you through a gentle check-in, organize what you share into a summary, suggest a wellbeing module, help you browse fictional demo professionals, and answer questions about your privacy. I do not diagnose, treat, or prescribe.",
    mood: 'understanding',
  },
};

function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[?!.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function fallbackResponse(): ChatbotResponse {
  return {
    content: "I'm here to listen and help you navigate Manas. You can ask me about your data, how to connect with a professional, or what I can help with. If you're in crisis, please reach out to local emergency services.",
    mood: 'understanding',
  };
}

export class ChatbotService {
  constructor(private deps: ChatbotServiceDeps) {}

  getQuickReplies(): string[] {
    return QUICK_REPLIES;
  }

  async respond(userId: string, message: string, _history: ChatMessage[]): Promise<ChatbotResponse> {
    const normalized = normalizeQuestion(message);

    // Deterministic, privacy-safe responses for known workflows.
    const deterministic = RESPONSE_MAP[normalized];
    if (deterministic) {
      await this.logExchange(userId, message, deterministic.content);
      return deterministic;
    }

    // Optional AI fallback for open-ended questions.
    if (this.deps.modelGateway) {
      try {
        const context: ModelGatewayContext = {
          sessionId: `chatbot-${userId}`,
          language: 'en',
          turnNumber: 1,
          previousExtractedUpdates: {},
        };
        const aiOutput = await this.deps.modelGateway.generate(
          `You are Manus, a warm, calm AI wellbeing companion. Answer briefly and compassionately. Never diagnose, prescribe, or claim to be a clinician. User asks: "${message}"`,
          context,
        );
        const parsed = ChatbotResponseSchema.parse({
          content: aiOutput.user_facing_response,
          mood: 'understanding',
        });
        await this.logExchange(userId, message, parsed.content);
        return parsed;
      } catch {
        // fall through to fallback
      }
    }

    const fallback = fallbackResponse();
    await this.logExchange(userId, message, fallback.content);
    return fallback;
  }

  private async logExchange(userId: string, userMessage: string, assistantMessage: string): Promise<void> {
    await this.deps.auditLogger.log({
      requestId: `chatbot-${Date.now()}`,
      userId,
      actor: 'system',
      eventType: 'CHATBOT_MESSAGE_EXCHANGED',
      details: { userMessage, assistantMessage },
    });
  }
}
