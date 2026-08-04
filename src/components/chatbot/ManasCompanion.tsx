'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';


interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  /** Contextual next steps returned by Manas for assistant messages. */
  suggestions?: string[];
}

interface ChatResponse {
  response: {
    content: string;
    mood: 'understanding' | 'reassuring' | 'encouraging' | 'reflective';
    suggestions?: string[];
  };
}

/** Evergreen topics, always available from the Explore tray. */
const EXPLORE_TOPICS = [
  'Start a check-in',
  'How does the check-in work?',
  'What can Manas help me with?',
  'What is a care plan?',
  'How do I connect with a professional?',
  'What happens to my data?',
  'Can I delete my check-in?',
  'Is this an emergency service?',
];

/** Grouped starter topics shown in the empty state. */
const STARTER_GROUPS: Array<{ label: string; icon: string; items: string[] }> = [
  {
    label: 'Begin',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    items: ['Start a check-in', 'How does the check-in work?'],
  },
  {
    label: 'Understand Manas',
    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    items: ['What can Manas help me with?', 'What is a care plan?', 'What are wellbeing modules?'],
  },
  {
    label: 'Privacy & safety',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    items: ['What happens to my data?', 'Can I delete my check-in?', 'Is this an emergency service?'],
  },
  {
    label: 'Connect',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    items: ['How do I connect with a professional?', 'How does consent work?'],
  },
];

function TopicChip({ label, onClick }: { label: string; onClick: () => void }): React.ReactNode {
  return (
    <button
      onClick={onClick}
      className="text-xs px-3 py-1.5 bg-surface border border-primary/20 text-primary rounded-full hover:bg-primary/5 hover:border-primary/40 transition-colors text-left"
    >
      {label}
    </button>
  );
}

function WelcomeBubble({ onDismiss }: { onDismiss: () => void }): React.ReactNode {
  return (
    <div className="absolute bottom-full right-0 mb-3 w-64 pointer-events-none animate-in fade-in slide-in-from-bottom-2">
      <div className="bg-surface border border-primary/20 rounded-2xl rounded-br-none shadow-lg p-4 pointer-events-auto">
        <p className="text-sm text-text font-medium mb-1">Hi, I&apos;m Manas</p>
        <p className="text-xs text-text-muted mb-3">
          Your privacy-first companion. Ask me about your data, professionals, or how I can help.
        </p>
        <button
          onClick={onDismiss}
          className="text-xs text-primary hover:underline font-medium"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

export function ManasCompanion(): React.ReactNode {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  const lastMessage = messages[messages.length - 1];
  const activeSuggestions =
    !loading && lastMessage?.role === 'assistant' ? (lastMessage.suggestions ?? []) : [];

  const dismissWelcome = (): void => {
    setShowWelcome(false);
    try {
      localStorage.setItem('manas-welcome-dismissed', 'true');
    } catch {
      // Ignore storage errors.
    }
  };

  useEffect(() => {
    const dismissed = localStorage.getItem('manas-welcome-dismissed');
    if (!dismissed) {
      const timer = setTimeout(() => setShowWelcome(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (!showWelcome) return;
    function handleClickOutside(event: MouseEvent): void {
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        dismissWelcome();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showWelcome]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (content: string): Promise<void> => {
    if (!content.trim() || loading) return;
    const userMessage: ChatMessage = {
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          history: messages,
        }),
      });
      const data: ChatResponse = await res.json();
      if (!res.ok) {
        throw new Error('Chat request failed.');
      }
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.response.content,
          timestamp: new Date().toISOString(),
          suggestions: data.response.suggestions,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat request failed.');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "I'm having trouble connecting right now. If you need crisis support, please contact local emergency services.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    void sendMessage(input);
  };

  return (
    <div ref={widgetRef} className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {showWelcome && !open && <WelcomeBubble onDismiss={dismissWelcome} />}

      {!open && (
        <button
          onClick={() => { setOpen(true); dismissWelcome(); }}
          className="group flex items-center gap-2 bg-primary hover:bg-primary-light text-white rounded-full pl-4 pr-2 py-2 shadow-lg transition-all"
          aria-label="Open Manas companion chat"
        >
          <span className="text-sm font-medium">Ask Manas</span>
          <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/30 bg-surface">
            <Image
              src="/manus-avatar.png"
              alt="Manas avatar"
              width={36}
              height={36}
              className="object-cover"
            />
          </div>
        </button>
      )}

      {open && (
        <div className="w-[90vw] max-w-sm bg-surface border border-text/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-primary-light text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/30 bg-surface">
                  <Image
                    src="/manus-avatar.png"
                    alt="Manas avatar"
                    width={36}
                    height={36}
                    className="object-cover"
                  />
                </div>
                <span
                  className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-300 border-2 border-primary rounded-full"
                  aria-hidden="true"
                />
              </div>
              <div>
                <p className="text-sm font-semibold">Manas</p>
                <p className="text-[10px] text-white/80">Privacy-first companion · always here</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/80 hover:text-white p-1"
              aria-label="Close chat"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 max-h-[50vh] overflow-y-auto p-4 space-y-3 bg-background">
            {messages.length === 0 && (
              <div className="py-2">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-primary/20 shrink-0">
                    <Image src="/manus-avatar.png" alt="" width={32} height={32} className="object-cover" />
                  </div>
                  <p className="text-sm text-text-muted leading-relaxed">
                    Hi, I&apos;m Manas. I&apos;m here whenever you want to reflect, understand your
                    data, or find the right support. Where would you like to start?
                  </p>
                </div>
                <div className="space-y-3">
                  {STARTER_GROUPS.map((group) => (
                    <div key={group.label}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d={group.icon} />
                        </svg>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          {group.label}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {group.items.map((item) => (
                          <TopicChip key={item} label={item} onClick={() => void sendMessage(item)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-white rounded-br-none'
                      : 'bg-surface border border-text/10 text-text rounded-bl-none'
                  }`}
                >
                  {msg.role === 'assistant' && i > 0 && messages[i - 1].role === 'user' && (
                    <div className="flex items-center gap-1 mb-1">
                      <div className="w-4 h-4 rounded-full overflow-hidden bg-surface">
                        <Image
                          src="/manus-avatar.png"
                          alt=""
                          width={16}
                          height={16}
                          className="object-cover"
                        />
                      </div>
                      <span className="text-[10px] font-medium text-primary">Manas</span>
                    </div>
                  )}
                  <p className="leading-relaxed whitespace-pre-line">{msg.content}</p>
                </div>
              </div>
            ))}

            {/* Proactive follow-up suggestions after the latest reply */}
            {activeSuggestions.length > 0 && (
              <div className="flex justify-start animate-in fade-in slide-in-from-bottom-1">
                <div className="max-w-[92%]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1.5 ml-1">
                    Where to next?
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {activeSuggestions.map((suggestion) => (
                      <TopicChip
                        key={suggestion}
                        label={suggestion}
                        onClick={() => void sendMessage(suggestion)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-surface border border-text/10 rounded-2xl rounded-bl-none px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:0.1s]" />
                    <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <p className="text-xs text-error text-center">{error}</p>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Persistent Explore tray — every option stays one tap away */}
          {messages.length > 0 && (
            <div className="border-t border-text/10 bg-surface px-3 pt-2.5 pb-1">
              <div className="flex items-center gap-2 overflow-x-auto pb-1.5 [scrollbar-width:thin]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted shrink-0">
                  Explore
                </span>
                {EXPLORE_TOPICS.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => void sendMessage(topic)}
                    disabled={loading}
                    className="shrink-0 text-[11px] px-2.5 py-1 bg-background border border-text/15 text-text-muted rounded-full hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 border-t border-text/10 bg-surface">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything…"
                maxLength={500}
                className="flex-1 border border-text/20 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-primary text-white rounded-full p-2 hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Send message"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-text-muted text-center mt-2">
              Not an emergency service. If you are in crisis, contact local emergency services.
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
