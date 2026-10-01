import { forwardRef, useState } from 'react';
import { CheckCircle2, Loader2, Mail, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api';
import { storedCampaignCode } from '@/lib/campaign';
import { CA_PATHS, GUIDE_SOURCE, caHref } from '../site';

const textDark = 'hsl(0 0% 10%)';
const textMuted = 'hsl(0 0% 45%)';
const accent = '#EA5404';

/**
 * The guide form — what "Send me guide" scrolls to.
 *
 * One required field. This is the cheapest thing anybody does on this page:
 * they are handing over an address to read something, not asking to be
 * reviewed, and every extra required box is somebody deciding it isn't worth
 * it. The name is optional purely so the email can open with it.
 *
 * Success is shown in place rather than by redirect — unlike a finished
 * application, nothing here needs its own URL, and bouncing someone off the
 * landing they were reading would cost the page its actual job.
 */
export const GuideSection = forwardRef<HTMLElement>(function GuideSection(_props, ref) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  /**
   * Read once, at mount. Never shown: it credits the channel this page was
   * posted on, which belongs to the traffic report rather than to the person
   * filling the form in.
   */
  const [campaignCode] = useState(storedCampaignCode);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;

    setIsSending(true);
    try {
      await apiRequest('/public/guide/request', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          source: GUIDE_SOURCE,
          campaignCode: campaignCode || undefined,
        }),
      });
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
    <section
      ref={ref}
      id="guide"
      className="px-8 md:px-12 py-24 md:py-32 scroll-mt-4"
      style={{ backgroundColor: 'hsl(30 30% 96%)' }}
    >
      <div className="max-w-2xl mx-auto text-center">
        {sentTo ? (
          <>
            <div
              className="mx-auto mb-7 flex items-center justify-center rounded-full"
              style={{ width: 64, height: 64, background: '#FBE3D3', color: accent }}
            >
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-3xl md:text-5xl font-light tracking-tight" style={{ color: textDark }}>
              Your key is on its way
            </h2>
            <p className="mt-5 text-base md:text-lg leading-relaxed" style={{ color: textMuted }}>
              We&apos;ve sent it to <strong style={{ color: textDark }}>{sentTo}</strong>. The email opens the guide in
              one tap — or paste the key on{' '}
              <a href={caHref(CA_PATHS.guide)} className="underline underline-offset-2" style={{ color: textDark }}>
                the guide page
              </a>
              . Check spam if it isn&apos;t there in a minute.
            </p>
          </>
        ) : (
          <>
            <p className="text-xs tracking-[0.25em] uppercase mb-4" style={{ color: textMuted }}>
              Free guide
            </p>
            <h2 className="text-3xl md:text-5xl font-light tracking-tight" style={{ color: textDark }}>
              Get the guide
            </h2>
            <p className="mt-5 text-base md:text-lg font-light leading-relaxed" style={{ color: textMuted }}>
              Everything worth knowing before you come — the place, the people, the costs, and how the month actually
              runs. Leave your email and we&apos;ll send your key to it.
            </p>

            <form className="mt-10 grid gap-4 text-left" onSubmit={submit}>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="guide-name" className="text-sm font-medium">
                    Your name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: textMuted }} />
                    <Input
                      id="guide-name"
                      type="text"
                      placeholder="Satoshi (optional)"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 border-0 bg-white shadow-sm focus-visible:ring-1"
                      style={{ color: textDark }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guide-email" className="text-sm font-medium">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: textMuted }} />
                    <Input
                      id="guide-email"
                      type="email"
                      placeholder="you@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 border-0 bg-white shadow-sm focus-visible:ring-1"
                      style={{ color: textDark }}
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSending}
                className="w-full h-12 text-xs tracking-[0.25em] uppercase font-semibold rounded-full"
                style={{ backgroundColor: accent, color: '#fff' }}
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send me guide'
                )}
              </Button>

              <p className="text-xs text-center" style={{ color: textMuted }}>
                One email with your key. No application is started by this.
              </p>
            </form>
          </>
        )}
      </div>
    </section>
  );
});
