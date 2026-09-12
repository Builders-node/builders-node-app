import { useEffect, useState } from 'react';
import { Check, Copy, Link2, Send, Share2, Wallet } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { apiRequest } from '../lib/api';
import { useAffiliateReward } from '../lib/affiliate';
import { TELEGRAM_COMMUNITY_URL } from '../lib/telegram';

type Referrals = {
  referralCode: string | null;
  /** Everyone who applied with the link. */
  referredCount: number;
  /** The subset who actually got in — what the payout is counted on. */
  joinedCount: number;
};

type AffiliateHubProps = {
  currentUserId: string | null;
};

/**
 * The member-side affiliate page: your link, and what it has done.
 *
 * Every account carries a referral code from the moment it is created, so there
 * is nothing to unlock here and nothing to wait for — which is the whole point
 * of sending people straight here after they register on the affiliate page.
 *
 * Two counts, deliberately. `referredCount` is how many people filled the form
 * in; `joinedCount` is how many got in, and that is the only one money is owed
 * on. Showing a single number would quietly imply a payout per form submission.
 */
export function AffiliateHub({ currentUserId }: AffiliateHubProps) {
  const [data, setData] = useState<Referrals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  /**
   * Both forms are useful and neither replaces the other: a link is what you
   * paste into a chat, the bare code is what you read out on a podcast.
   */
  const [mode, setMode] = useState<'link' | 'code'>('link');
  const [copied, setCopied] = useState(false);
  const reward = useAffiliateReward();

  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    apiRequest<Referrals>(`/users/${currentUserId}/referrals`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load your referrals.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  const code = data?.referralCode ?? '';
  const inviteLink = code ? `${window.location.origin}/?ref=${code}` : '';
  const shareValue = mode === 'link' ? inviteLink : code;
  const earned = (data?.joinedCount ?? 0) * reward.cents;

  async function copy() {
    if (!shareValue) return;
    try {
      await navigator.clipboard.writeText(shareValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard is blocked in some embedded browsers; a prompt still lets
      // them get the link out by hand rather than leaving the button dead.
      window.prompt('Copy this', shareValue);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Affiliate"
        description={`Share your link. You earn ${reward.amount} for every person who joins Builders Node through it.`}
      />

      {error ? (
        <section className="panel">
          <p className="form-error">{error}</p>
        </section>
      ) : null}

      {isLoading ? (
        <section className="panel">
          <p>Loading your link…</p>
        </section>
      ) : null}

      {!isLoading && !error && !code ? (
        <section className="panel empty-state">
          Your account doesn&apos;t have a referral code yet. Contact us and we&apos;ll sort it out.
        </section>
      ) : null}

      {code ? (
        <>
          <section className="panel affiliate-hub__share">
            <span className="section-label">Your link</span>

            <div className="segmented affiliate-hub__modes" role="tablist" aria-label="What to share">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'link'}
                className={mode === 'link' ? 'segmented__opt segmented__opt--active' : 'segmented__opt'}
                onClick={() => { setMode('link'); setCopied(false); }}
              >
                Link
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'code'}
                className={mode === 'code' ? 'segmented__opt segmented__opt--active' : 'segmented__opt'}
                onClick={() => { setMode('code'); setCopied(false); }}
              >
                Code
              </button>
            </div>

            <div className="affiliate-hub__value">
              <input
                value={shareValue}
                readOnly
                aria-label={mode === 'link' ? 'Your affiliate link' : 'Your affiliate code'}
                onFocus={(event) => event.currentTarget.select()}
              />
              <button className="primary-button compact-button" onClick={() => void copy()}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <p className="affiliate-hub__hint">
              {mode === 'link'
                ? 'Anyone who opens this link is credited to you for 30 days, even if they come back later to apply.'
                : 'They can type this into the referral field on the application form — it counts the same as the link.'}
            </p>
          </section>

          <section className="status-grid affiliate-hub__stats">
            <article className="status-card">
              <div className="status-card__top">
                <span>Applied with your link</span>
              </div>
              <strong className="affiliate-hub__figure">{data?.referredCount ?? 0}</strong>
            </article>
            <article className="status-card">
              <div className="status-card__top">
                <span>Joined</span>
              </div>
              <strong className="affiliate-hub__figure">{data?.joinedCount ?? 0}</strong>
            </article>
            <article className="status-card">
              <div className="status-card__top">
                <span>Earned</span>
              </div>
              {/* Counted from people who got in, not from applications — see
                  the two counts above. */}
              <strong className="affiliate-hub__figure">{formatMoney(earned, reward.currency)}</strong>
            </article>
          </section>

          <section className="panel affiliate-hub__how">
            <h2>How it works</h2>
            <ol className="affiliate-hub__steps">
              <li>
                <span className="affiliate-hub__step-icon"><Share2 size={16} /></span>
                <div>
                  <strong>Share your link</strong>
                  <p>Post it, send it to one person, say the code out loud — whatever fits the people you reach.</p>
                </div>
              </li>
              <li>
                <span className="affiliate-hub__step-icon"><Link2 size={16} /></span>
                <div>
                  <strong>They apply with it</strong>
                  <p>The link fills the code in for them. Their application shows up above the moment it lands.</p>
                </div>
              </li>
              <li>
                <span className="affiliate-hub__step-icon"><Wallet size={16} /></span>
                <div>
                  <strong>You get paid</strong>
                  <p>
                    {reward.amount} for each one who joins, once they&apos;re accepted and have paid their first month.
                    No cap on how many.
                  </p>
                </div>
              </li>
            </ol>
            <a
              className="ghost-button compact-button affiliate-hub__ask"
              href={TELEGRAM_COMMUNITY_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Send size={16} />
              Questions? Ask us
            </a>
          </section>
        </>
      ) : null}
    </div>
  );
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
