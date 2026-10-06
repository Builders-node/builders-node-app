import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api';
import { storedCampaignCode } from '@/lib/campaign';
import { CA_PATHS, GUIDE_SOURCE, caHref } from '../site';

const panel = 'hsl(24 14% 9%)';
const panelText = 'hsl(0 0% 100%)';
const panelMuted = 'hsl(0 0% 100% / 0.62)';
const accent = '#EA5404';
const field = 'hsl(30 30% 96%)';

/**
 * The guide ask, as a dark panel with the email field right in it.
 *
 * Rendered more than once down the page on purpose — it is the one thing this
 * landing wants, and a reader who is convinced by the intro should not have to
 * scroll to the bottom to act on it. Each copy keeps its own state, so
 * submitting one leaves the others as they were rather than silently claiming
 * the reader already did it.
 *
 * Marked `data-guide-cta` so the hero and gallery buttons can scroll to
 * whichever copy is nearest — see CaLanding.
 */
type GuideCtaProps = {
  /** Which site this sits on: decides the guide the email opens. CA by default. */
  site?: 'main' | 'ca';
  heading?: string;
  /** Omit for none. */
  description?: string | null;
};

const CA_HEADING = 'Get the complete Buildersnode founder guide';
const CA_DESCRIPTION =
  'Everything you need to know before deciding: the program, pricing, the vibe, what a day here looks like and flights from Canada.';

export function GuideCta({ site = GUIDE_SOURCE, heading = CA_HEADING, description = CA_DESCRIPTION }: GuideCtaProps = {}) {
  // The gate page the success note points at: this site's own /guide.
  const guidePageHref = site === 'ca' ? caHref(CA_PATHS.guide) : '/guide';
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  /**
   * The address was recorded but the email didn't leave. Worth saying rather
   * than hiding: "on its way" would be a promise nothing is going to keep, and
   * the lead does show up in admin as unsent for somebody to pick up.
   */
  const [heldUp, setHeldUp] = useState(false);
  /**
   * Read once, at mount. Never shown: it credits the channel this page was
   * posted on, which belongs to the traffic report rather than to the reader.
   */
  const [campaignCode] = useState(storedCampaignCode);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;

    setIsSending(true);
    try {
      const result = await apiRequest<{ sent: boolean }>('/public/guide/request', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          source: site,
          campaignCode: campaignCode || undefined,
        }),
      });
      setHeldUp(result.sent === false);
      setSentTo(email.trim());

      // One conversion event per lead, same shape as the apply form's.
      try {
        (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag?.('event', 'generate_lead', {
          lead_type: 'guide_request',
        });
        (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq?.('track', 'Lead');
      } catch {
        /* tracking is never worth failing a submission over */
      }
    } catch (error) {
      toast({
        title: 'Could not send it',
        description: error instanceof Error ? error.message : 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section data-guide-cta className="px-6 sm:px-8 md:px-12 py-10 md:py-14 scroll-mt-24">
      <div
        className="rounded-3xl px-7 py-12 sm:px-12 sm:py-14 md:px-16 md:py-16"
        style={{ backgroundColor: panel }}
      >
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <h2
              className="text-3xl sm:text-4xl md:text-[2.75rem] font-light tracking-tight leading-[1.15]"
              style={{ color: panelText }}
            >
              {heading}
            </h2>
            {description ? (
              <p className="mt-5 text-base leading-relaxed max-w-md" style={{ color: panelMuted }}>
                {description}
              </p>
            ) : null}
          </div>

          <div className="lg:justify-self-end w-full lg:max-w-md">
            {sentTo ? (
              <div>
                <p
                  className="inline-flex items-center gap-2 text-lg font-medium"
                  style={{ color: panelText }}
                >
                  <Check size={20} style={{ color: accent }} aria-hidden="true" />
                  {heldUp ? "We've got your address" : 'Your guide is on the way'}
                </p>
                {heldUp ? (
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: panelMuted }}>
                    Our email is having trouble right now, so{' '}
                    <strong style={{ color: panelText }}>{sentTo}</strong> hasn&apos;t received the key yet. It&apos;s on
                    our list and someone will send it over.
                  </p>
                ) : (
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: panelMuted }}>
                    Sent to <strong style={{ color: panelText }}>{sentTo}</strong>. The email opens the guide in one tap
                    — or paste the key on{' '}
                    <a href={guidePageHref} className="underline underline-offset-2" style={{ color: panelText }}>
                      the guide page
                    </a>
                    . Check spam if it isn&apos;t there in a minute.
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={submit}>
                {/* One row on anything but a phone: the field and the button
                    read as a single control, which is what makes the ask feel
                    like one step rather than a form. */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="email"
                    required
                    aria-label="Your email"
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 min-w-0 rounded-full px-6 text-base outline-none"
                    style={{
                      height: 56,
                      backgroundColor: field,
                      color: 'hsl(0 0% 10%)',
                      border: '1px solid transparent',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = accent; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
                  />
                  <button
                    type="submit"
                    disabled={isSending}
                    className="inline-flex items-center justify-center gap-2 rounded-full px-7 text-base font-semibold whitespace-nowrap transition-transform hover:scale-[1.03] disabled:opacity-70 disabled:hover:scale-100"
                    style={{ height: 56, backgroundColor: accent, color: '#fff', border: 'none', cursor: 'pointer' }}
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send me the guide'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
