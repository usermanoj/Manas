import type { AuditLogger } from '@/domain/audit';

export interface ChatbotServiceDeps {
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
  /** Contextual next steps the UI can surface as tappable suggestions. */
  suggestions?: string[];
}

const QUICK_REPLIES = [
  'Start a check-in',
  'What happens to my data?',
  'How do I connect with a professional?',
  'Can I delete my check-in?',
  'Is this an emergency service?',
  'How does the check-in work?',
  'What is a care plan?',
];

const RESPONSE_MAP: Record<string, ChatbotResponse> = {
  'what happens to my data': {
    content:
      'Your privacy matters to me. Here is how your data is handled: your check-in conversations are stored for your session and shown to you on the Privacy page, where you can view, edit, exclude, export, or delete anything at any time. Nothing is shared with a professional without your explicit, current consent. Private conversations are not used to train models by default, and every notable action creates an audit event you can review.',
    mood: 'reassuring',
    suggestions: ['Can I delete my check-in?', 'Can I export my data?', 'Do you train on my data?'],
  },
  'how do i connect with a professional': {
    content:
      'Connecting is designed to be calm and consent-first. Step 1: complete a Check-In and confirm your summary. Step 2: open the Professionals directory — you can browse every profile freely without an account. Step 3: when a profile feels right, tap "Request Intro". You will sign in, review exactly what will be shared, tick the consent box, and send a handoff. Nothing is shared until you press send, and you can edit or exclude items first.',
    mood: 'understanding',
    suggestions: ['Start a check-in', 'How does consent work?', 'Are the professionals real?'],
  },
  'can i delete my check-in': {
    content:
      'Yes. Visit the Privacy page to see your check-in sessions and delete any of them. Deleting creates an audit event so you always have a transparent record of what happened. You can also exclude specific entries from a handoff instead of deleting them, if you want to keep them for yourself but not share them.',
    mood: 'encouraging',
    suggestions: ['Can I export my data?', 'What happens to my data?'],
  },
  'is this an emergency service': {
    content:
      'No, Manas is not an emergency service. If you are in crisis, thinking about hurting yourself, or feel unsafe, please contact your local emergency services or a crisis helpline right away. I am here for everyday reflection, stress support, and care navigation — not immediate intervention.',
    mood: 'reassuring',
    suggestions: ['Start a check-in', 'What can Manas help me with?'],
  },
  'what can manas help me with': {
    content:
      'Here is what I can do with you: (1) guide a gentle, bounded Check-In conversation about everyday stress, (2) organise what you share into an editable structured summary, (3) suggest a labelled prototype wellbeing module such as Pause & Reflect, (4) route you deterministically to the right level of support without diagnosing, (5) help you browse fictional demo professionals and prepare a consent-controlled handoff, and (6) answer questions about your privacy and data. I do not diagnose, treat, prescribe, or replace a clinician.',
    mood: 'understanding',
    suggestions: ['How does the check-in work?', 'What is a care plan?', 'What are wellbeing modules?'],
  },
  'what can you do': {
    content:
      'I can walk you through a Check-In, turn what you share into an editable summary, suggest a wellbeing module, help you browse professionals, and explain your privacy options. Ask me "How does the check-in work?" or "What is a care plan?" to go deeper. I do not diagnose, treat, or prescribe.',
    mood: 'understanding',
    suggestions: ['How does the check-in work?', 'What is a care plan?', 'What happens to my data?'],
  },
  'help': {
    content:
      'I am glad you reached out. The best starting point is a Check-In — tell me what has been feeling most difficult and I will guide you step by step. You can also ask me about professionals, care plans, wellbeing modules, or your privacy options. If you are in crisis, please contact local emergency services right away.',
    mood: 'understanding',
    suggestions: ['Start a check-in', 'How does the check-in work?', 'What happens to my data?'],
  },
  'who are you': {
    content:
      'I am Manas, a privacy-first AI wellbeing companion. I can help you reflect on everyday stress, navigate the app, and understand your privacy options. I am an AI guide, not a clinician, and I do not provide diagnosis or treatment.',
    mood: 'understanding',
    suggestions: ['What can Manas help me with?', 'Start a check-in'],
  },
  'are you a doctor': {
    content:
      'No — I am Manas, an AI wellbeing companion. I am not a doctor, psychologist, psychiatrist, or counsellor, and I do not diagnose or treat any condition. My role is to help you reflect, organise your thoughts, and navigate to human professionals when you want that support.',
    mood: 'reassuring',
  },
  'are you a therapist': {
    content:
      'I am not a therapist. I am Manas, an AI companion for everyday wellbeing and care navigation. If you would like support from a human professional, I can show you how the consent-controlled handoff works in the Professionals directory.',
    mood: 'reassuring',
  },
  'hello': {
    content: 'Hi there, I am Manas, your wellbeing companion. How can I help you today?',
    mood: 'encouraging',
    suggestions: ['Start a check-in', 'What can Manas help me with?', 'What happens to my data?'],
  },
  'hi': {
    content: 'Hi there, I am Manas, your wellbeing companion. How can I help you today?',
    mood: 'encouraging',
    suggestions: ['Start a check-in', 'What can Manas help me with?', 'What happens to my data?'],
  },
  'start a check-in': {
    content:
      'You can start a Check-In from the Check-In page. Tap "Begin Check-In" and share, in your own words, what has been feeling most difficult. I will ask a few gentle follow-ups about duration, sleep, daily impact, and safety, then suggest a technique that fits what you describe. Afterwards you will see an editable summary that you control before anything is confirmed.',
    mood: 'encouraging',
    suggestions: ['How does the check-in work?', 'What happens to my data?'],
  },
  'how does the check-in work': {
    content:
      'A Check-In has four parts: (1) we chat — you describe what has been hard, and I ask a few gentle clarifying questions; (2) I extract a structured summary — primary concern, duration, sleep and daily impact, and your support preference — which you can edit on the Summary page; (3) you confirm it, and deterministic, non-diagnostic routing suggests an appropriate level of support; (4) optionally you can explore a wellbeing module or request an intro to a professional. You stay in control at every step.',
    mood: 'encouraging',
    suggestions: ['Start a check-in', 'What is routing?'],
  },
  'what is a care plan': {
    content:
      'A care plan is your personalised support roadmap, created by a clinician from your approved handoff. Every change creates a new immutable version — Version 2 never overwrites Version 1 — and a plan only becomes active after both clinician approval and your own acceptance. You can pause, revise, or retire plans, and every action appears in your audit timeline. I cannot modify an active care plan; only a human clinician can propose changes.',
    mood: 'understanding',
    suggestions: ['How do I connect with a professional?', 'What are wellbeing modules?'],
  },
  'what are wellbeing modules': {
    content:
      'Wellbeing modules are short, guided exercises. In this prototype there is one labelled module called Pause & Reflect — a brief breathing and reflection practice for moments of stress. All module content carries the label "Prototype wellbeing content — not clinically reviewed", and every module has a status and immutable version. I can suggest a module, but only human reviewers approve content.',
    mood: 'encouraging',
    suggestions: ['What is the Pause and Reflect module?', 'Start a check-in'],
  },
  'what is the pause and reflect module': {
    content:
      'Pause & Reflect is a short guided exercise: you settle in with slow breathing, notice what you are feeling without judging it, and gently reflect on one small next step. It is designed for everyday stress moments and takes only a few minutes. Like all modules here, it is labelled prototype content — not clinically reviewed, and not a treatment.',
    mood: 'encouraging',
    suggestions: ['Start a check-in', 'How do I connect with a professional?'],
  },
  'how does consent work': {
    content:
      'Consent on Manas is explicit, current, and specific. Signing in is not consent to share anything. Before a handoff reaches a professional, you review exactly which summary fields will be shared, you can edit or exclude items, and you must tick the consent checkbox and press send yourself. After sending, the handoff becomes read-only and immutable, and you can see the consent event in your audit timeline.',
    mood: 'reassuring',
    suggestions: ['What is a handoff?', 'How do I connect with a professional?'],
  },
  'what is a handoff': {
    content:
      'A handoff is a structured summary of your confirmed check-in, prepared for a professional you choose. You decide exactly what is included, give explicit consent, and send it. Once sent, it is read-only and immutable, so both you and the professional see the same record. Nothing is shared without your consent, and you can review the event in your audit timeline.',
    mood: 'understanding',
    suggestions: ['How does consent work?', 'How do I connect with a professional?'],
  },
  'can i export my data': {
    content:
      'Yes. The Privacy page lets you view, edit, exclude, export, or delete your remembered information. Every check-in session is listed there, and any action you take creates an audit event so the record stays transparent.',
    mood: 'encouraging',
    suggestions: ['Can I delete my check-in?', 'What happens to my data?'],
  },
  'do you train on my data': {
    content:
      'No — your private conversations are not used to train models by default, and raw conversations are never written into ordinary logs or analytics. Your data stays visible and controllable on the Privacy page.',
    mood: 'reassuring',
    suggestions: ['What happens to my data?', 'Can I delete my check-in?'],
  },
  'are the professionals real': {
    content:
      'The professionals shown in the directory are fictional demonstration profiles with demo pricing — no real contact requests are sent and no real payments are processed. The flow is designed to show exactly how a real, consent-controlled introduction would work.',
    mood: 'reassuring',
    suggestions: ['How do I connect with a professional?', 'How does consent work?'],
  },
  'how much does it cost': {
    content:
      'Prices shown on professional profiles are fictional demonstration values — no real payments are processed in this prototype. Browsing the directory is free and needs no account; you only sign in when you request an introduction.',
    mood: 'reassuring',
    suggestions: ['How do I connect with a professional?', 'Start a check-in'],
  },
  'what is routing': {
    content:
      'Routing is how Manas suggests an appropriate level of support after you confirm your summary — for example self-guided reflection, a wellbeing module, or connecting with a professional. It is deterministic and rule-based, never a diagnosis, and safety routing always runs separately from the conversational AI.',
    mood: 'understanding',
    suggestions: ['Start a check-in', 'What is a care plan?'],
  },
  'thank you': {
    content: "You're welcome. Take your time, and feel free to come back whenever you need a moment to reflect.",
    mood: 'encouraging',
    suggestions: ['Start a check-in', 'What are wellbeing modules?'],
  },
  'thanks': {
    content: "You're welcome. Take your time, and feel free to come back whenever you need a moment to reflect.",
    mood: 'encouraging',
    suggestions: ['Start a check-in', 'What are wellbeing modules?'],
  },
  'goodbye': {
    content: 'Take care. I will be here when you need me.',
    mood: 'reassuring',
  },
  'bye': {
    content: 'Take care. I will be here when you need me.',
    mood: 'reassuring',
  },
};

const TOPIC_RESPONSES: Array<{ keywords: string[]; response: ChatbotResponse }> = [
  {
    keywords: ['suicide', 'kill myself', 'end my life', 'want to die', 'hurt myself', 'self-harm', 'self harm', 'suicidal', 'no reason to live', 'end it all'],
    response: {
      content:
        "I'm really concerned to hear that, and I'm glad you told me. Manas is not an emergency service and I can't provide immediate help. If you feel unsafe or are thinking about hurting yourself, please contact your local emergency services or a crisis helpline right away. If you can, reach out to someone you trust and stay with them. You don't have to go through this alone.",
      mood: 'reassuring',
      suggestions: ['How do I connect with a professional?'],
    },
  },
  {
    keywords: ['anxious', 'anxiety', 'worried', 'worry', 'nervous', 'panic', 'panicking', 'restless', 'on edge', 'overthinking', 'overthink', 'racing thoughts'],
    response: {
      content:
        "It sounds like you're carrying a lot of worry right now. Noticing anxiety is an important first step. One small thing that can help in the moment: slow breathing with a longer exhale — in for 4, out for 6, for about a minute — which signals your nervous system to settle. The best way I can help is through a Check-In, where I can help you put what you're feeling into words and suggest a technique that fits. I'm not a clinician, but I'm here to reflect with you.",
      mood: 'understanding',
    },
  },
  {
    keywords: ['stressed', 'stress', 'overwhelmed', 'overwhelm', 'pressure', 'deadline', 'burnout', 'workload', 'burned out', 'too much work'],
    response: {
      content:
        "Work-related stress can feel really heavy, especially when deadlines pile up. You're not alone in this. Two things often help: first, naming the single biggest pressure rather than holding all of them at once; second, a short settling practice like the Pause & Reflect module. If you start a Check-In, I can help you organise what's going on and suggest a technique. If stress has been building for a while, a professional can help with longer-term strategies.",
      mood: 'understanding',
    },
  },
  {
    keywords: ['sad', 'depressed', 'depression', 'down', 'low', 'unhappy', 'hopeless', 'lonely', 'empty', 'numb', 'no motivation', 'unmotivated'],
    response: {
      content:
        "I'm sorry you're feeling this way. Low mood is worth paying attention to, and it often lifts a little with small anchors — daylight, movement, or one brief conversation with someone you trust. A Check-In can help you put words around what you're experiencing. If these feelings are intense, persistent, or hard to manage, speaking with a mental-health professional can make a real difference — I can show you how to connect in the Professionals section.",
      mood: 'reassuring',
    },
  },
  {
    keywords: ['sleep', 'tired', 'exhausted', 'insomnia', 'cant sleep', "can't sleep", 'rest', 'fatigue', 'awake', 'sleepless'],
    response: {
      content:
        "Sleep and rest have a big impact on how we feel during the day. If your sleep has been off, a gentle wind-down helps: dim screens about 30 minutes before bed, slow your breathing, and write down tomorrow's top concern so it isn't circling while you try to rest. A Check-In can capture what's happening and I can suggest a relaxation technique. If it's been going on for a while, a professional can help you explore it further.",
      mood: 'understanding',
    },
  },
  {
    keywords: ['breathe', 'breathing', 'mindful', 'mindfulness', 'meditation', 'calm', 'relax', 'grounding'],
    response: {
      content:
        'Great instinct — simple practices like mindful breathing can help settle the nervous system. A good starting point: breathe in for 4 counts, hold for 4, out for 6, and repeat five times. During a Check-In I will suggest a technique with step-by-step guidance, and the Pause & Reflect module walks you through a short practice. You can also browse the Professionals page for coaches and clinicians who teach these skills.',
      mood: 'encouraging',
    },
  },
  {
    keywords: ['angry', 'anger', 'frustrated', 'frustration', 'irritated', 'annoyed', 'furious'],
    response: {
      content:
        'Frustration and anger are natural responses to stress, especially at work. Noticing them without acting on impulse is a strength. Before responding to whatever triggered it, try a short pause: step away, take three slow breaths, and name the feeling to yourself. A Check-In can help you explore what is underneath the frustration and suggest a way to cool down.',
      mood: 'understanding',
    },
  },
  {
    keywords: ['focus', 'concentrate', 'distracted', 'scatter', 'brain fog', 'forgetful', 'procrastinat'],
    response: {
      content:
        "Trouble concentrating often shows up when we're stressed or tired — attention follows energy. A simple reset is a short focus block: pick one task, set 20 minutes, and silence notifications. A Check-In can help identify what might be pulling your attention away, and I can suggest a grounding exercise. If it persists, a professional can help rule out other causes.",
      mood: 'understanding',
    },
  },
  {
    keywords: ['physical', 'tension', 'headache', 'muscle', 'shoulder', 'chest tight', 'body ache', 'tight neck', 'jaw'],
    response: {
      content:
        "Our bodies often signal stress before our minds do. Tension, headaches, or tightness can be linked to stress. Try a quick body scan: slowly move your attention from your shoulders to your jaw to your hands, softening each as you go. A Check-In can help you notice the mind-body connection, and I can suggest a body-based relaxation technique. If you have physical symptoms you're unsure about, please consult a medical professional.",
      mood: 'understanding',
    },
  },
  {
    keywords: ['boundaries', 'work life balance', 'work-life balance', 'after hours', 'always on', 'can\'t switch off', 'cant switch off'],
    response: {
      content:
        "Blurred boundaries between work and rest are a common source of stress. One small, sustainable step is a closing ritual: at a set time, write down where you stopped and what comes tomorrow, then deliberately step away. A Check-In can help you look at what's pulling at you, and a professional can help you build longer-term boundaries.",
      mood: 'understanding',
    },
  },
  {
    keywords: ['grief', 'loss', 'died', 'passed away', 'missing someone'],
    response: {
      content:
        "I'm sorry for what you're going through. Grief is a natural response to loss, and it moves in its own rhythm — there is no right way or timeline for it. Be gentle with yourself, and lean on people you trust. If grief feels impossible to carry, a professional can walk alongside you — I can show you how to connect.",
      mood: 'reassuring',
    },
  },
];

function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[?!.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchTopicResponse(text: string): ChatbotResponse | null {
  const normalized = text.toLowerCase();
  for (const topic of TOPIC_RESPONSES) {
    if (topic.keywords.some((keyword) => normalized.includes(keyword))) {
      return topic.response;
    }
  }
  return null;
}

function fallbackResponse(message: string): ChatbotResponse {
  const normalized = message.toLowerCase();
  const emotionWords = ['feel', 'feeling', 'mood', 'emotion', 'upset', 'worried', 'anxious', 'sad', 'stress'];
  const appWords = ['check', 'summary', 'care plan', 'handoff', 'professional', 'privacy', 'data', 'login', 'sign in'];

  if (emotionWords.some((word) => normalized.includes(word))) {
    return {
      content:
        "I hear you. If you'd like, start a Check-In and tell me more about what's going on — that's the best way for me to offer a technique that fits. I'm not a clinician, but I can help you reflect. If you're in crisis, please contact local emergency services.",
      mood: 'understanding',
    };
  }

  if (appWords.some((word) => normalized.includes(word))) {
    return {
      content:
        "I can help with that. The Check-In page is where we talk, the Summary page shows what we captured, and the Privacy page lets you review or delete your data. Let me know if you'd like directions to any of them.",
      mood: 'encouraging',
    };
  }

  return {
    content:
      "I'm here to listen and help you navigate Manas. You can ask me about your data, how to connect with a professional, or what I can help with. If you're in crisis, please reach out to local emergency services.",
    mood: 'understanding',
  };
}

/**
 * If the candidate reply is identical to the last assistant message in the
 * conversation, append a gentle next-step nudge so the exchange never feels
 * like a broken record.
 */
function avoidRepetition(response: ChatbotResponse, history: ChatMessage[]): ChatbotResponse {
  const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant');
  if (lastAssistant && lastAssistant.content === response.content) {
    return {
      ...response,
      content: `${response.content} If you would like to go deeper, a Check-In is the best next step — or ask me about care plans, modules, consent, or your privacy options.`,
    };
  }
  return response;
}

/** Gentle, evergreen next steps used when a response has no specific ones. */
const DEFAULT_SUGGESTIONS = [
  'Start a check-in',
  'What can Manas help me with?',
  'What happens to my data?',
];

function withDefaultSuggestions(response: ChatbotResponse): ChatbotResponse {
  if (response.suggestions) return response;
  return { ...response, suggestions: DEFAULT_SUGGESTIONS };
}

export class ChatbotService {
  constructor(private deps: ChatbotServiceDeps) {}

  getQuickReplies(): string[] {
    return QUICK_REPLIES;
  }

  async respond(userId: string, message: string, history: ChatMessage[]): Promise<ChatbotResponse> {
    const normalized = normalizeQuestion(message);

    // Deterministic, privacy-safe responses for known workflows.
    const deterministic = RESPONSE_MAP[normalized];
    if (deterministic) {
      const reply = withDefaultSuggestions(avoidRepetition(deterministic, history));
      await this.logExchange(userId, message, reply.content);
      return reply;
    }

    // Topic-aware responses for common wellbeing cues.
    const topicResponse = matchTopicResponse(message);
    if (topicResponse) {
      const reply = withDefaultSuggestions(avoidRepetition(topicResponse, history));
      await this.logExchange(userId, message, reply.content);
      return reply;
    }

    // For anything else, give a contextual fallback rather than a repetitive generic answer.
    const fallback = withDefaultSuggestions(avoidRepetition(fallbackResponse(message), history));
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
