'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';


interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatResponse {
  response: {
    content: string;
    mood: 'understanding' | 'reassuring' | 'encouraging' | 'reflective';
  };
}

const QUICK_REPLIES = [
  'What happens to my data?',
  'How do I connect with a professional?',
  'Can I delete my check-in?',
  'Is this an emergency service?',
  'What can Manus help me with?',
];

function WelcomeBubble({ onDismiss }: { onDismiss: () => void }): React.ReactNode {
  return (
    <div className="absolute bottom-full right-0 mb-3 w-64 pointer-events-none animate-in fade-in slide-in-from-bottom-2">
      <div className="bg-surface border border-primary/20 rounded-2xl rounded-br-none shadow-lg p-4 pointer-events-auto">
        <p className="text-sm text-text font-medium mb-1">Hi, I&apos;m Manus</p>
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

export function ManusCompanion(): React.ReactNode {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  const dismissWelcome = (): void => {
    setShowWelcome(false);
    try {
      localStorage.setItem('manus-welcome-dismissed', 'true');
    } catch {
      // Ignore storage errors.
    }
  };

  useEffect(() => {
    const dismissed = localStorage.getItem('manus-welcome-dismissed');
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
          aria-label="Open Manus companion chat"
        >
          <span className="text-sm font-medium">Ask Manus</span>
          <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/30 bg-surface">
            <Image
              src="/manus-avatar.png"
              alt="Manus avatar"
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
          <div className="bg-primary text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/30 bg-surface">
                <Image
                  src="/manus-avatar.png"
                  alt="Manus avatar"
                  width={36}
                  height={36}
                  className="object-cover"
                />
              </div>
              <div>
                <p className="text-sm font-semibold">Manus</p>
                <p className="text-[10px] text-white/80">Privacy-first companion</p>
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
              <div className="text-center py-4">
                <p className="text-sm text-text-muted mb-3">
                  I can help with questions about your data, professionals, and what Manas can do.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {QUICK_REPLIES.map((reply) => (
                    <button
                      key={reply}
                      onClick={() => void sendMessage(reply)}
                      className="text-xs px-3 py-1.5 bg-surface border border-primary/20 text-primary rounded-full hover:bg-primary/5 transition-colors"
                    >
                      {reply}
                    </button>
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
                      <span className="text-[10px] font-medium text-primary">Manus</span>
                    </div>
                  )}
                  <p className="leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}

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
