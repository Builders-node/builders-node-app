import { useEffect, useState } from 'react';
import { KeyRound, Loader2, Lock, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/api';
import { storedCampaignCode } from '@/lib/campaign';
import logo from '@/assets/logo.svg';
import { CA_PATHS, GUIDE_SOURCE, applyUrl, caHref } from '../site';

const textDark = 'hsl(0 0% 10%)';
const textMuted = 'hsl(0 0% 45%)';
const accent = '#EA5404';

/**
 * Remembered so a reader who comes back doesn't have to find the email again.
 *
 * localStorage rather than a cookie: nothing on the server needs it, and the
 * key is not a credential — it unlocks a marketing PDF, and one copy of it is
 * already in their inbox.
 */
const KEY_STORAGE = 'terminus_guide_key';

/**
 * The gated guide.
 *
 * Three states, and which one shows is decided by the key: locked, checking, or
 * open. The guide's location is never in this bundle — it comes back from the
 * server only once the key holds, because a gate whose answer ships to every
 * visitor in the JavaScript is theatre.
 *
 * The key is universal, which is worth being honest about: it buys the email
 * address and a moment of friction, not secrecy. The first reader to paste it
 * into a group chat has published it.
 */
export function CaGuide() {
  const [key, setKey] = useState('');
  const [guideUrl, setGuideUrl] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The email path, for a reader who arrived without a key.
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [campaignCode] = useState(storedCampaignCode);

  /**
   * Try the key in the link first, then the one from last time.
   *
   * `?key=` is what the email's button carries, so the common path is a single
   * tap with nothing to type. It is stripped from the address bar on success so
   * the key doesn't end up in a screenshot or a pasted URL.
   */
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('key');
    const remembered = (() => {
      try {
        return localStorage.getItem(KEY_STORAGE);
      } catch {
        return null;
      }
    })();
    const candidate = fromUrl ?? remembered;
    if (!candidate) return;

    setKey(candidate);
    void attempt(candidate, { quiet: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function attempt(candidate: string, options: { quiet?: boolean } = {}) {
    setIsChecking(true);
    setError(null);
    try {
      const result = await apiRequest<{ guideUrl: string }>('/public/guide/unlock', {
        method: 'POST',
        body: JSON.stringify({ key: candidate.trim() }),
      });
      setGuideUrl(result.guideUrl);
      try {
        localStorage.setItem(KEY_STORAGE, candidate.trim());
      } catch {
        /* private mode — they'll just enter it again next time */
      }
      // Take the key back out of the address bar now that it has been used, so
      // it can't travel in a screenshot or a pasted URL. Only that parameter:
      // dropping the whole query would also throw away the `?src=` a campaign
      // link arrived with.
      const address = new URL(window.location.href);
      if (address.searchParams.has('key')) {
        address.searchParams.delete('key');
        window.history.replaceState(null, '', `${address.pathname}${address.search}`);
      }
    } catch (caught) {
      // A remembered key that has since been rotated shouldn't greet a reader
      // with a red error they did nothing to cause — it just falls back to the
      // locked screen.
      try {
        localStorage.removeItem(KEY_STORAGE);
      } catch {
        /* nothing to clear */
      }
      if (!options.quiet) {
        setError(caught instanceof Error ? caught.message : 'That key is not right.');
      }
    } finally {
      setIsChecking(false);
    }
  }

  async function requestKey(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setIsSending(true);
    setError(null);
    try {
      await apiRequest('/public/guide/request', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          source: GUIDE_SOURCE,
          campaignCode: campaignCode || undefined,
        }),
      });
      setSentTo(email.trim());
      try {
        (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag?.('event', 'generate_lead', {
          lead_type: 'guide_request',
        });
        (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq?.('track', 'Lead');
      } catch {
        /* tracking is never worth failing a submission over */
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not send the key. Please try again.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div
      className="landing-root"
      style={{ minHeight: '100vh', backgroundColor: 'hsl(30 30% 96%)', color: textDark }}
    >
      <header className="border-b" style={{ borderColor: 'hsl(0 0% 88%)' }}>
        <div className="flex items-center justify-between px-6 sm:px-10 md:px-12" style={{ height: 68 }}>
          <a href={caHref(CA_PATHS.landing)} className="flex items-center" aria-label="Builders Node">
            <img src={logo} alt="Builders Node" className="h-6 w-auto" />
          </a>
          <a
            href={applyUrl()}
            className="rounded-full px-5 py-2 text-xs tracking-[0.15em] uppercase font-semibold transition-transform hover:scale-105"
            style={{ backgroundColor: accent, color: '#fff' }}
          >
            Apply now
          </a>
        </div>
      </header>

      {guideUrl ? (
        <GuideReader url={guideUrl} />
      ) : (
        <main className="px-6 sm:px-10 md:px-12 py-16 sm:py-24">
          <div className="max-w-md mx-auto text-center">
            <div
              className="mx-auto mb-7 flex items-center justify-center rounded-full"
              style={{ width: 64, height: 64, background: '#FBE3D3', color: accent }}
            >
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-light tracking-tight">The private guide</h1>
            <p className="mt-4 text-base leading-relaxed" style={{ color: textMuted }}>
              Enter your key to read it. Don&apos;t have one? Leave your email and we&apos;ll send it over.
            </p>

            <form
              className="mt-9 grid gap-3 text-left"
              onSubmit={(event) => {
                event.preventDefault();
                void attempt(key);
              }}
            >
              <Label htmlFor="guide-key" className="text-sm font-medium">
                Your key
              </Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: textMuted }} />
                <Input
                  id="guide-key"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="BN-XXXX-XXXX"
                  value={key}
                  onChange={(e) => { setKey(e.target.value); setError(null); }}
                  className="pl-10 border-0 bg-white shadow-sm focus-visible:ring-1"
                  style={{ color: textDark, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                />
              </div>
              <Button
                type="submit"
                disabled={isChecking || !key.trim()}
                className="h-12 text-xs tracking-[0.25em] uppercase font-semibold rounded-full"
                style={{ backgroundColor: textDark, color: 'hsl(30 30% 96%)' }}
              >
                {isChecking ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  'Open the guide'
                )}
              </Button>
              {error ? (
                <p className="text-sm text-center" style={{ color: 'hsl(0 72% 45%)' }}>
                  {error}
                </p>
              ) : null}
            </form>

            <div className="my-10 flex items-center gap-4">
              <span className="h-px flex-1" style={{ backgroundColor: 'hsl(0 0% 10% / 0.12)' }} />
              <span className="text-xs tracking-[0.2em] uppercase" style={{ color: textMuted }}>
                No key?
              </span>
              <span className="h-px flex-1" style={{ backgroundColor: 'hsl(0 0% 10% / 0.12)' }} />
            </div>

            {sentTo ? (
              <p className="text-base leading-relaxed" style={{ color: textMuted }}>
                Sent to <strong style={{ color: textDark }}>{sentTo}</strong>. Open the link in that email, or paste the
                key above. Check spam if it isn&apos;t there in a minute.
              </p>
            ) : (
              <form className="grid gap-3 text-left" onSubmit={requestKey}>
                <Label htmlFor="guide-key-email" className="text-sm font-medium">
                  Your email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: textMuted }} />
                  <Input
                    id="guide-key-email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 border-0 bg-white shadow-sm focus-visible:ring-1"
                    style={{ color: textDark }}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isSending}
                  className="h-12 text-xs tracking-[0.25em] uppercase font-semibold rounded-full border"
                  style={{ backgroundColor: 'transparent', borderColor: 'hsl(0 0% 10% / 0.25)', color: textDark }}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Email me the key'
                  )}
                </Button>
              </form>
            )}
          </div>
        </main>
      )}
    </div>
  );
}

/**
 * The guide itself, once unlocked.
 *
 * An iframe rather than a redirect so the reader stays on the page they
 * unlocked — going Back from a redirect would land them on the key screen
 * again. The direct link sits underneath for anything an iframe can't show,
 * which on iOS is most PDFs.
 */
function GuideReader({ url }: { url: string }) {
  return (
    <main className="px-4 sm:px-8 md:px-12 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-5">
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight">The private guide</h1>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline underline-offset-2"
            style={{ color: textMuted }}
          >
            Open in a new tab
          </a>
        </div>
        <div
          className="rounded-sm overflow-hidden bg-white"
          style={{ border: '1px solid hsl(0 0% 88%)', height: 'calc(100vh - 220px)', minHeight: 480 }}
        >
          <iframe src={url} title="Builders Node private guide" className="w-full h-full" style={{ border: 0 }} />
        </div>
        <p className="mt-4 text-sm text-center" style={{ color: textMuted }}>
          Can&apos;t see it?{' '}
          <a href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" style={{ color: textDark }}>
            Open it directly
          </a>
          .
        </p>
      </div>
    </main>
  );
}
