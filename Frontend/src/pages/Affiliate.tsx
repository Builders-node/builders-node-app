import { useRef, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Link2, Minus, Plus, Send, Share2, Wallet } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import Footer from '@/components/Footer';
import AffiliateForm from '@/components/AffiliateForm';
import { ApplyNavProvider, AccountNavProvider } from '@/lib/applyNav';
import { useAffiliateReward } from '@/lib/affiliate';
import { useStartingPrice } from '@/lib/membership-plans';
import { useGsapTitle } from '@/hooks/useGsapTitle';
import { TELEGRAM_COMMUNITY_URL } from '@/lib/telegram';
import logo from '@/assets/logo.svg';
import heroImage from '@/assets/gallery-9.webp';
import type { PageId } from '../data/dashboard';

type AffiliateProps = {
  setActivePage: (page: PageId) => void;
  currentUserId?: string | null;
};

const textDark = 'hsl(0 0% 10%)';
const textMuted = 'hsl(0 0% 45%)';
const borderLight = 'hsl(0 0% 10% / 0.12)';
const accent = '#EA5404';

/** Who this is for — stated plainly, because a bad fit wastes both sides' time. */
const audiences = [
  {
    num: '/01',
    title: 'Creators and writers',
    body: 'You have an audience of founders, builders or remote workers — on YouTube, X, a podcast, or a newsletter they actually open.',
  },
  {
    num: '/02',
    title: 'Community organisers',
    body: 'You run a Telegram group, a Discord, or a local founder meetup, and people ask you where to go next.',
  },
  {
    num: '/03',
    title: 'Members and alumni',
    body: "You've lived here. Nothing we write converts like somebody describing the month they actually had.",
  },
  {
    num: '/04',
    title: 'Scouts and connectors',
    body: "You don't have an audience, you have a contact list — and you know exactly which five people belong here.",
  },
];

export function Affiliate({ setActivePage, currentUserId }: AffiliateProps) {
  const [done, setDone] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const reward = useAffiliateReward();
  const { price: startingPrice } = useStartingPrice();
  // The heading names the payout, which arrives from the API a moment after
  // mount — and the character-split animation can only run once, so it has to
  // wait for the real number rather than freeze on the fallback.
  const titleRef = useGsapTitle<HTMLHeadingElement>(reward.isSettled);

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const steps = [
    {
      num: '/01',
      icon: Send,
      title: 'Apply',
      body: 'Tell us who you reach and how you would talk about us. We read every application by hand and answer either way.',
    },
    {
      num: '/02',
      icon: Link2,
      title: 'Get your link',
      body: 'Approved affiliates get a personal link and a code. Anyone who applies through either one is credited to you — no spreadsheets, no screenshots.',
    },
    {
      num: '/03',
      icon: Share2,
      title: 'Share it',
      body: 'Post it, say it on a podcast, send it to the one person you know it fits. There is no quota and no exclusivity.',
    },
    {
      num: '/04',
      icon: Wallet,
      title: 'Get paid',
      body: `${reward.amount} for every person who joins through you, paid once they're a member. One-time, per person, no cap on how many.`,
    },
  ];

  const faqs = [
    {
      q: 'When exactly do I get paid?',
      a: `Once the person you sent has been accepted and has paid for their first month. We pay ${reward.amount} per person — a flat amount, not a percentage, so you always know what a referral is worth before you post about it.`,
    },
    {
      q: 'Is there a limit?',
      a: 'No cap. Send one person a year or ten in a month — the amount per person is the same either way.',
    },
    {
      q: 'Do I need to live at Builders Node?',
      a: "No. Members make excellent affiliates because they can describe the place first-hand, but it isn't a requirement. What matters is that the people you reach would genuinely fit here.",
    },
    {
      q: 'How is a referral tracked?',
      a: "Your link carries your code. Someone who follows it is remembered in their browser for 30 days, so they can read the site, sleep on it and still be credited to you when they apply. If they'd rather type the code into the application form themselves, that counts the same.",
    },
    {
      q: 'What if two people refer the same person?',
      a: 'The most recent link they followed wins. Following somebody else\'s link is a clear signal about who actually convinced them.',
    },
    {
      q: 'Can I run paid ads on your name?',
      a: "No. Bidding on our brand terms means paying to reach people who were already looking for us, and we'd be paying you twice for it. Everything else — your own content, your own audience — is fair game.",
    },
    {
      q: 'What am I actually selling?',
      a: `Membership starts at ${startingPrice}/month and includes a serviced room, meals, coworking, gym, pool and the community itself, in Próspera on Roatán. You're not selling a course — you're telling somebody where to spend the next few months of their life.`,
    },
    {
      q: 'How do I know how many people joined through me?',
      a: 'Approved affiliates get an account here. It shows your link, your code, and a running count of everyone who applied with it.',
    },
  ];

  return (
    <MemoryRouter>
      <TooltipProvider>
        {/* The footer's big CTA belongs to this page's form, not to the member
            application — an affiliate who reached the bottom is not applying to
            move in. */}
        <ApplyNavProvider openApply={scrollToForm}>
          <AccountNavProvider
            value={{
              currentUserId: currentUserId ?? null,
              openAccount: () => setActivePage('profile'),
              openLogin: () => setActivePage('login'),
              // Already here — the footer's affiliate link goes to the form.
              openAffiliate: scrollToForm,
            }}
          >
            <div className="landing-root min-h-screen" style={{ backgroundColor: 'hsl(30 30% 93%)', color: textDark }}>
              {/* Header. Its own, not the landing Navbar: that one's links are
                  anchors into sections this page doesn't have. */}
              <header className="border-b" style={{ borderColor: borderLight }}>
                <div className="flex items-center justify-between px-6 sm:px-10 md:px-12" style={{ height: 68 }}>
                  <button type="button" onClick={() => setActivePage('landing')} className="flex items-center" aria-label="Builders Node home">
                    <img src={logo} alt="Builders Node" className="h-6 w-auto" />
                  </button>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={scrollToForm}
                      className="rounded-full px-5 py-2 text-xs tracking-[0.15em] uppercase font-semibold transition-transform hover:scale-105"
                      style={{ backgroundColor: accent, color: '#fff', boxShadow: '0 6px 20px rgba(234, 84, 4, 0.35)' }}
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePage(currentUserId ? 'profile' : 'login')}
                      className="rounded-full px-5 py-2 text-xs tracking-[0.15em] uppercase font-medium border transition-colors hover:bg-black/5"
                      style={{ borderColor: 'hsl(0 0% 10% / 0.25)', color: textDark }}
                    >
                      {currentUserId ? 'Account' : 'Log in'}
                    </button>
                  </div>
                </div>
              </header>

              {/* Hero */}
              <section className="px-8 md:px-12 pt-16 md:pt-24 pb-16">
                <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
                  <div>
                    <p className="text-xs tracking-[0.25em] uppercase mb-5" style={{ color: textMuted }}>
                      Affiliate programme
                    </p>
                    {/* Not rendered until the payout is known — see titleRef. */}
                    {reward.isSettled ? (
                      <h1
                        ref={titleRef}
                        className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light tracking-tight leading-[1.03]"
                        style={{ color: textDark }}
                      >
                        Earn {reward.amount} for everyone you send
                      </h1>
                    ) : (
                      // Holds the space so the page doesn't jump when the real
                      // heading arrives a moment later.
                      <div style={{ minHeight: '3.5em' }} aria-hidden="true" />
                    )}
                    <p className="mt-6 text-base md:text-lg font-light leading-relaxed max-w-xl" style={{ color: textMuted }}>
                      Builders Node is a startup society in Próspera, Roatán — rooms, meals, coworking, gym and a community of
                      founders, from {startingPrice}/month. If you know the people who belong here, share your link and get paid
                      for each one who joins.
                    </p>
                    <div className="mt-9 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={scrollToForm}
                        className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-xs tracking-[0.25em] uppercase font-semibold transition-transform hover:scale-105"
                        style={{ backgroundColor: accent, color: '#fff', boxShadow: '0 10px 28px rgba(234, 84, 4, 0.45)' }}
                      >
                        Become an affiliate
                        <ArrowRight size={14} aria-hidden="true" />
                      </button>
                      <a
                        href={TELEGRAM_COMMUNITY_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-xs tracking-[0.25em] uppercase font-semibold border transition-colors hover:bg-black/5"
                        style={{ borderColor: 'hsl(0 0% 10% / 0.25)', color: textDark }}
                      >
                        <Send size={14} aria-hidden="true" />
                        Ask us first
                      </a>
                    </div>

                    <div className="mt-12 grid grid-cols-3 gap-6 max-w-lg">
                      {[
                        { value: reward.isSettled ? reward.amount : '—', label: 'Per person who joins' },
                        { value: 'No cap', label: 'On how many you send' },
                        { value: '30 days', label: 'Your link stays credited' },
                      ].map((stat) => (
                        <div key={stat.label}>
                          <div className="text-2xl md:text-3xl font-light" style={{ color: textDark }}>
                            {stat.value}
                          </div>
                          <div className="mt-1 text-[11px] tracking-[0.12em] uppercase leading-tight" style={{ color: textMuted }}>
                            {stat.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="relative h-72 sm:h-96 lg:h-[30rem] rounded-sm overflow-hidden">
                    <img src={heroImage} alt="Builders Node community in Próspera" className="w-full h-full object-cover" />
                  </div>
                </div>
              </section>

              {/* How it works */}
              <section className="px-8 md:px-12 py-20 md:py-28">
                <p className="text-xs tracking-[0.25em] uppercase mb-4" style={{ color: textMuted }}>
                  How it works
                </p>
                <h2 className="text-3xl md:text-5xl font-light tracking-tight mb-14" style={{ color: textDark }}>
                  Four steps, and only one of them is work
                </h2>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px" style={{ backgroundColor: borderLight }}>
                  {steps.map((step) => {
                    const Icon = step.icon;
                    return (
                      <div key={step.title} className="p-7 md:p-8" style={{ backgroundColor: 'hsl(30 30% 93%)' }}>
                        <div className="flex items-center gap-3 mb-5">
                          <span className="text-xs tracking-[0.15em]" style={{ color: textMuted }}>
                            {step.num}
                          </span>
                          <Icon className="w-5 h-5" style={{ color: accent }} />
                        </div>
                        <h3 className="text-xl font-light mb-3" style={{ color: textDark }}>
                          {step.title}
                        </h3>
                        <p className="text-sm leading-relaxed" style={{ color: textMuted }}>
                          {step.body}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* The terms, stated once and plainly */}
              <section className="px-8 md:px-12 py-20 md:py-28">
                <div className="rounded-sm p-10 md:p-16" style={{ background: 'linear-gradient(135deg, hsl(16 90% 45%), hsl(25 100% 50%))' }}>
                  <p className="text-xs tracking-[0.25em] uppercase mb-5" style={{ color: 'hsl(0 0% 100% / 0.65)' }}>
                    The terms
                  </p>
                  <h2 className="text-3xl md:text-5xl font-light tracking-tight max-w-2xl" style={{ color: '#fff' }}>
                    {reward.isSettled ? reward.amount : '—'}, once, for each person who joins through you
                  </h2>
                  <div className="mt-10 grid md:grid-cols-3 gap-8 max-w-4xl">
                    {[
                      'A flat amount, not a percentage — you know what a referral is worth before you post.',
                      'Paid after they are accepted and have paid their first month.',
                      'No quota, no exclusivity, no minimum. Send one person or twenty.',
                    ].map((line) => (
                      <div key={line} className="flex gap-3">
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'hsl(0 0% 100% / 0.9)' }} />
                        <p className="text-sm leading-relaxed" style={{ color: 'hsl(0 0% 100% / 0.85)' }}>
                          {line}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Who it's for */}
              <section className="px-8 md:px-12 py-20 md:py-28">
                <p className="text-xs tracking-[0.25em] uppercase mb-4" style={{ color: textMuted }}>
                  Who it&apos;s for
                </p>
                <h2 className="text-3xl md:text-5xl font-light tracking-tight mb-4" style={{ color: textDark }}>
                  Reach beats reach count
                </h2>
                <p className="text-base md:text-lg font-light max-w-xl mb-12" style={{ color: textMuted }}>
                  We would rather work with someone trusted by two hundred founders than someone followed by fifty thousand
                  strangers. Tell us who listens to you.
                </p>

                <div>
                  {audiences.map((item) => (
                    <div key={item.title} className="border-b py-7 md:py-9" style={{ borderColor: borderLight }}>
                      <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-8">
                        <span className="text-xs tracking-[0.15em] md:w-8 md:pt-2 flex-shrink-0" style={{ color: textMuted }}>
                          {item.num}
                        </span>
                        <h3 className="text-xl md:text-2xl font-light md:w-80 flex-shrink-0" style={{ color: textDark }}>
                          {item.title}
                        </h3>
                        <p className="text-sm md:text-base leading-relaxed max-w-xl" style={{ color: textMuted }}>
                          {item.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* FAQ */}
              <section className="px-8 md:px-12 py-20 md:py-28">
                <h2 className="text-4xl md:text-6xl font-light tracking-tight mb-10" style={{ color: textDark }}>
                  Questions
                </h2>
                <div>
                  {faqs.map((faq, i) => {
                    const isOpen = openFaq === i;
                    return (
                      <div
                        key={faq.q}
                        className="border-b cursor-pointer"
                        style={{ borderColor: borderLight }}
                        onClick={() => setOpenFaq(isOpen ? null : i)}
                      >
                        <div className="flex items-center justify-between py-6 md:py-8">
                          <div className="flex items-center gap-4">
                            <span className="text-xs tracking-[0.15em] w-8" style={{ color: textMuted }}>
                              /{String(i + 1).padStart(2, '0')}
                            </span>
                            <h3
                              className="text-lg md:text-xl font-light transition-colors duration-300"
                              style={{ color: isOpen ? 'hsl(16 90% 45%)' : textDark }}
                            >
                              {faq.q}
                            </h3>
                          </div>
                          <div className="flex-shrink-0 ml-4" style={{ color: textMuted }}>
                            {isOpen ? <Minus className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                          </div>
                        </div>
                        <div
                          className="overflow-hidden transition-all duration-300"
                          style={{ maxHeight: isOpen ? '320px' : '0', opacity: isOpen ? 1 : 0 }}
                        >
                          <p className="pl-12 pr-4 md:pr-12 pb-6 text-base leading-relaxed" style={{ color: textMuted }}>
                            {faq.a}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* The form */}
              <section ref={formRef} id="affiliate-apply" className="px-8 md:px-12 py-20 md:py-28 scroll-mt-4">
                <div className="max-w-3xl mx-auto">
                  {done ? (
                    <div className="text-center py-10">
                      <div
                        className="mx-auto mb-7 flex items-center justify-center rounded-full"
                        style={{ width: 64, height: 64, background: '#FBE3D3', color: accent }}
                      >
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h2 className="text-3xl md:text-5xl font-light tracking-tight" style={{ color: textDark }}>
                        Application received
                      </h2>
                      <p className="mt-5 text-base md:text-lg max-w-lg mx-auto leading-relaxed" style={{ color: textMuted }}>
                        We&apos;ve emailed you a confirmation. Someone here reads every application by hand, so give us a few
                        days — you&apos;ll hear back either way, and your link comes with the yes.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActivePage('landing')}
                        className="mt-9 h-12 px-8 text-xs tracking-[0.25em] uppercase font-semibold rounded-full"
                        style={{ backgroundColor: textDark, color: 'hsl(30 30% 93%)' }}
                      >
                        Back to Builders Node
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs tracking-[0.25em] uppercase mb-4" style={{ color: textMuted }}>
                        Apply
                      </p>
                      <h2 className="text-3xl md:text-5xl font-light tracking-tight" style={{ color: textDark }}>
                        Tell us who you reach
                      </h2>
                      <p className="mt-4 text-base md:text-lg font-light leading-relaxed max-w-xl" style={{ color: textMuted }}>
                        Five minutes, and no obligation on either side. If it&apos;s a fit we&apos;ll send your link straight
                        back.
                      </p>
                      <div className="mt-10">
                        <AffiliateForm onSuccess={() => setDone(true)} />
                      </div>
                    </>
                  )}
                </div>
              </section>

              <Footer />
            </div>
          </AccountNavProvider>
        </ApplyNavProvider>
        <Toaster />
        <Sonner />
      </TooltipProvider>
    </MemoryRouter>
  );
}
