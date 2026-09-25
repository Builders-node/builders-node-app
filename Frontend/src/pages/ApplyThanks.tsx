import { useState } from 'react';
import { CheckCircle2, Mail, Send } from 'lucide-react';
import logo from '@/assets/logo.svg';
import { takeApplyThanks } from '../lib/applyThanks';
import { TELEGRAM_COMMUNITY_URL } from '../lib/telegram';
import type { PageId } from '../data/dashboard';

type ApplyThanksProps = {
  setActivePage: (page: PageId) => void;
  currentUserId?: string | null;
};

/**
 * Where a finished application lands, by a real page load.
 *
 * Its job is half copy and half analytics. The distinct URL is what an
 * "URL contains /apply-thanks" goal in Google Ads or Meta can key off, and the
 * full document load is what makes GA4, Clarity and the Pixel each record it —
 * see lib/applyThanks.ts for why it is not an in-app navigation.
 *
 * Deliberately fires no conversion event of its own. `generate_lead` / `Lead`
 * stay where the application is actually created, on the emailed-code step: a
 * refresh here would otherwise count a second conversion, and someone who
 * confirms their code but abandons the password screen has still applied.
 */
export function ApplyThanks({ setActivePage, currentUserId }: ApplyThanksProps) {
  /**
   * Read once, on mount. Present only for somebody who has just been through
   * the form in this tab — a shared link or a refresh gets null, and the page
   * says something true for them instead of thanking them for nothing.
   */
  const [applicant] = useState(takeApplyThanks);
  const justApplied = applicant !== null;

  return (
    <div
      className="landing-root"
      style={{ minHeight: '100vh', backgroundColor: 'hsl(30 30% 96%)', color: 'hsl(0 0% 10%)' }}
    >
      <header className="border-b" style={{ borderColor: 'hsl(0 0% 88%)' }}>
        <div className="flex items-center justify-between px-6 sm:px-10 md:px-12" style={{ height: 68 }}>
          <button
            type="button"
            onClick={() => setActivePage(currentUserId ? 'profile' : 'landing')}
            className="flex items-center"
            aria-label="Builders Node home"
          >
            <img src={logo} alt="Builders Node" className="h-6 w-auto" />
          </button>
        </div>
      </header>

      <main className="px-6 sm:px-10 md:px-12 pb-28 pt-16 sm:pt-24">
        <div className="max-w-2xl mx-auto text-center">
          <div
            className="mx-auto mb-8 flex items-center justify-center rounded-full"
            style={{ width: 72, height: 72, background: '#FBE3D3', color: '#EA5404' }}
          >
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <h1 className="text-4xl sm:text-5xl font-light tracking-tight leading-[1.05]">
            {justApplied && firstNameOf(applicant.fullName)
              ? `Thanks, ${firstNameOf(applicant.fullName)}`
              : 'Application received'}
          </h1>

          {justApplied ? (
            <>
              <p className="mt-6 text-base md:text-lg leading-relaxed" style={{ color: 'hsl(0 0% 40%)' }}>
                Your application is in. Someone here reads every one of them by hand, so give us a few days — you&apos;ll
                hear back either way.
              </p>
              {applicant.email ? (
                <p
                  className="mt-4 inline-flex items-center gap-2 text-sm"
                  style={{ color: 'hsl(0 0% 45%)' }}
                >
                  <Mail size={15} aria-hidden="true" />
                  We&apos;ve emailed a confirmation to <strong style={{ color: 'hsl(0 0% 20%)' }}>{applicant.email}</strong>
                </p>
              ) : null}
            </>
          ) : (
            // No handoff: a refresh, a shared link, or somebody who never
            // applied. Saying "your application is in" here would be a lie.
            <p className="mt-6 text-base md:text-lg leading-relaxed" style={{ color: 'hsl(0 0% 40%)' }}>
              Applications are reviewed by hand, and everyone hears back by email. If you haven&apos;t applied yet, the
              form is still open.
            </p>
          )}

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setActivePage(currentUserId ? 'profile' : 'landing')}
              className="h-12 px-7 text-xs tracking-[0.25em] uppercase font-semibold rounded-full"
              style={{ backgroundColor: 'hsl(0 0% 10%)', color: 'hsl(30 30% 96%)' }}
            >
              {currentUserId ? 'Go to your account' : 'Back to site'}
            </button>
            {!justApplied && !currentUserId ? (
              <button
                type="button"
                onClick={() => setActivePage('apply')}
                className="h-12 px-7 text-xs tracking-[0.25em] uppercase font-semibold rounded-full border"
                style={{ borderColor: 'hsl(0 0% 10% / 0.25)', color: 'hsl(0 0% 10%)' }}
              >
                Apply now
              </button>
            ) : null}
          </div>

          <p className="mt-10 text-sm" style={{ color: 'hsl(0 0% 45%)' }}>
            While you wait —{' '}
            <a
              href={TELEGRAM_COMMUNITY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 underline underline-offset-2"
              style={{ color: 'hsl(0 0% 15%)' }}
            >
              <Send size={14} aria-hidden="true" />
              join the Telegram community
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}

/** "Hi Nina" reads like a person wrote it; "Hi Nina Alvarez" reads like a mail merge. */
function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? '';
}
