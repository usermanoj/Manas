import Image from 'next/image';
import { BRAND } from '@/lib/config/brand';
import { SetupBar } from '@/components/landing/SetupBar';

/**
 * The public marketing landing page — shown to signed-out visitors.
 * Signed-in users get the personal sanctuary (SignedInHome) instead.
 */
const VALUE_POINTS = [
  {
    title: 'Calm check-ins',
    desc: 'Check-ins that meet you where you are.',
    icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  },
  {
    title: 'Guided care plans',
    desc: 'Plans shaped with you, never imposed.',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  },
  {
    title: 'Professional handoffs',
    desc: 'Professional support, on your terms.',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    title: 'Private & secure',
    desc: 'Control what is remembered or shared.',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
];

/** Promise points shown beside the companion — restored from the original artwork. */
const COMPANION_POINTS = [
  {
    label: 'I’m here to listen',
    icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  },
  {
    label: 'Your privacy is protected',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  {
    label: 'Thoughtful guidance',
    icon: 'M12 3v2m0 14v2m9-9h-2M5 12H3m14.364-6.364l-1.414 1.414M7.05 16.95l-1.414 1.414m11.314 0l-1.414-1.414M7.05 7.05L5.636 5.636M16 12a4 4 0 11-8 0 4 4 0 018 0z',
  },
  {
    label: 'Support when you need it',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
];

export function MarketingLanding(): React.ReactNode {
  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Ambient background wash */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 -right-32 w-[32rem] h-[32rem] rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute top-1/3 -left-40 w-[28rem] h-[28rem] rounded-full bg-secondary/15 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[24rem] h-[24rem] rounded-full bg-accent/10 blur-3xl" />
      </div>

      {/* AI Disclosure strip */}
      <div className="relative bg-surface/70 backdrop-blur-sm border-b border-text/10">
        <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 py-2`}>
          <p className="text-[11px] text-text-muted text-center leading-relaxed">{BRAND.disclosure}</p>
        </div>
      </div>

      {/* Main content — the hero expands into the free space while the action
          card settles calmly toward the bottom, keeping the page airy */}
      <div className="flex-1 flex flex-col">
      {/* Hero */}
      <section className="relative flex-1 flex items-center">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 [@media(min-height:840px)]:py-10 w-full">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
            {/* Left — brand, promise, value points */}
            <div>
              <div className="animate-fade-up">
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-primary text-[11px] font-semibold uppercase tracking-[0.18em] mb-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
                  Your digital wellbeing companion
                </span>
                <h1 className="text-4xl md:text-5xl [@media(min-height:840px)]:md:text-6xl font-bold tracking-tight text-text mb-3">
                  {BRAND.name}
                </h1>
                <p className="text-base md:text-lg text-text-muted leading-relaxed max-w-lg mb-8 [@media(min-height:840px)]:mb-10">
                  A calm, private space to check in, reflect, and find your next step — with Manas
                  quietly by your side.
                </p>
              </div>

              {/* Value points — a clean single-column list on desktop so every line reads cleanly */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-x-8 gap-y-3.5 [@media(min-height:840px)]:gap-y-4">
                {VALUE_POINTS.map((point, i) => (
                  <div
                    key={point.title}
                    className="group flex items-start gap-3 animate-fade-up"
                    style={{ animationDelay: `${0.15 + i * 0.08}s` }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/12 to-secondary/12 border border-primary/15 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110">
                      <svg className="w-[18px] h-[18px] text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d={point.icon} />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold text-text">{point.title}</p>
                      <p className="text-xs [@media(min-height:840px)]:text-[13px] text-text-muted leading-relaxed mt-0.5 line-clamp-3">{point.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — companion visual with its promise panel; nudged down so
                its "Manas" title lines up with the left column's heading
                (badge height + margin ≈ card padding + this offset) */}
            <div className="relative flex justify-center lg:justify-end lg:pt-3.5 animate-fade-up" style={{ animationDelay: '0.2s' }}>
              {/* One boundary around the promise text + character, like the original artwork */}
              <div className="relative w-full max-w-md [@media(min-height:840px)]:max-w-none flex items-center gap-4 [@media(min-height:840px)]:gap-8 rounded-3xl border border-text/10 bg-surface/60 backdrop-blur-sm shadow-xl shadow-text/5 p-5 [@media(min-height:840px)]:p-8">
                {/* Restored companion intro */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-3xl [@media(min-height:840px)]:text-4xl font-bold tracking-tight text-text mb-2">
                    {BRAND.name}
                  </h2>
                  <p className="text-xs [@media(min-height:840px)]:text-base text-text-muted leading-relaxed mb-4 [@media(min-height:840px)]:mb-7">
                    Your digital companion.
                    <br />
                    Here to listen. Here to guide.
                  </p>
                  <ul className="space-y-2 [@media(min-height:840px)]:space-y-3.5">
                    {COMPANION_POINTS.map((point) => (
                      <li key={point.label} className="flex items-center gap-2.5 [@media(min-height:840px)]:gap-3">
                        <span className="w-7 h-7 [@media(min-height:840px)]:w-9 [@media(min-height:840px)]:h-9 rounded-lg bg-gradient-to-br from-primary/12 to-secondary/12 border border-primary/15 flex items-center justify-center shrink-0">
                          <svg className="w-3.5 h-3.5 [@media(min-height:840px)]:w-4 [@media(min-height:840px)]:h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d={point.icon} />
                          </svg>
                        </span>
                        <span className="text-xs [@media(min-height:840px)]:text-sm font-medium text-text">{point.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Character */}
                <div className="relative w-[54%] shrink-0">
                  {/* Glow behind character */}
                  <div
                    className="absolute inset-x-4 top-6 bottom-0 rounded-[40%] bg-gradient-to-br from-primary/15 via-secondary/15 to-accent/20 blur-2xl"
                    aria-hidden="true"
                  />
                  <Image
                    src="/manas-companion.png"
                    alt="Manas — a calm digital companion"
                    width={1198}
                    height={1111}
                    priority
                    className="relative w-full h-auto object-contain drop-shadow-[0_24px_48px_rgba(45,55,72,0.12)]"
                  />

                  {/* Floating chip — top right */}
                  <div className="absolute top-4 -right-2 animate-float-slow">
                    <div className="flex items-center gap-1.5 bg-surface/90 backdrop-blur border border-text/10 rounded-full pl-2 pr-3 py-1.5 shadow-lg shadow-text/5">
                      <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" aria-hidden="true" />
                      <span className="text-[10px] font-semibold text-text whitespace-nowrap">Always here</span>
                    </div>
                  </div>

                  {/* Floating chip — bottom left (kept clear of the illustration) */}
                  <div className="absolute -bottom-4 -left-3 animate-float-slow" style={{ animationDelay: '1.5s' }}>
                    <div className="flex items-center gap-2 bg-surface/90 backdrop-blur border border-text/10 rounded-xl px-3 py-2 shadow-lg shadow-text/5">
                      <svg className="w-3.5 h-3.5 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <div>
                        <p className="text-[10px] font-semibold text-text whitespace-nowrap">Privacy-first</p>
                        <p className="text-[9px] text-text-muted whitespace-nowrap">No judgement, ever</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Setup — anchored low with generous clearance below */}
      <section className="relative">
        <div className="max-w-4xl mx-auto px-4 md:px-8 pt-4 pb-8 [@media(min-height:840px)]:pb-12">
          <div className="bg-surface/80 backdrop-blur-sm rounded-3xl border border-text/10 shadow-xl shadow-text/5 px-6 md:px-8 py-3 [@media(min-height:840px)]:py-4 animate-fade-up" style={{ animationDelay: '0.35s' }}>
            <div className="flex flex-col items-center gap-3.5">
              {/* Language + mode + gated CTA — client-driven so Connected Care can route through sign-in */}
              <SetupBar />
            </div>

            <p className="mt-2 [@media(min-height:840px)]:mt-3 text-[10px] [@media(min-height:840px)]:text-[11px] text-text-muted text-center leading-relaxed [@media(min-width:1024px)]:whitespace-nowrap">
              {BRAND.hackathonDisclaimer} All professional profiles are fictional demo profiles.
            </p>
          </div>
        </div>
      </section>
      </div>

      {/* Footer */}
      <footer className="relative bg-surface/70 backdrop-blur-sm border-t border-text/10">
        <div className={`${BRAND.spacing.pageMaxWidth} mx-auto px-4 py-2 [@media(min-height:840px)]:py-2.5 text-center`}>
          <p className="text-[11px] text-text-muted font-medium">
            Not an emergency service. If you are in crisis, please contact local emergency services.
          </p>
        </div>
      </footer>
    </div>
  );
}
