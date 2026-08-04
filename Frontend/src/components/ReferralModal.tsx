import { Check, Copy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import { useModalA11y } from '../lib/useModalA11y';

type ReferralModalProps = {
  userId: string;
  inviteLink: string;
  referralCode: string;
  onClose: () => void;
};

export function ReferralModal({ userId, inviteLink, referralCode, onClose }: ReferralModalProps) {
  const [count, setCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  /**
   * Both forms are useful and neither replaces the other: a link is what you
   * paste into a chat, the bare code is what you read out loud or someone types
   * into the form by hand.
   */
  const [mode, setMode] = useState<'link' | 'code'>('link');
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  const value = mode === 'link' ? inviteLink : referralCode;

  useEffect(() => {
    apiRequest<{ referredCount: number }>(`/users/${userId}/referrals`)
      .then((data) => setCount(data.referredCount))
      .catch(() => setCount(null));
  }, [userId]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="referral-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Invite friends"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="icon-button referral-modal__close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <h2>Invite friends</h2>
        <p className="referral-modal__sub">
          Share your link or your code — whoever applies to Builders Node with it is counted as your referral.
        </p>

        <div className="segmented referral-modal__modes" role="tablist" aria-label="What to share">
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

        <div className="referral-modal__link">
          <input
            value={value}
            readOnly
            aria-label={mode === 'link' ? 'Your invite link' : 'Your referral code'}
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
        <button className="primary-button referral-modal__copy" onClick={() => void copy()}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Copied' : mode === 'link' ? 'Copy link' : 'Copy code'}
        </button>

        <div className="referral-modal__stat">
          <strong>{count ?? '—'}</strong>
          <span>{count === 1 ? 'person has' : 'people have'} joined via your link</span>
        </div>

        <div className="referral-modal__steps">
          <div className="referral-step">
            <span>1</span>
            <div>
              <strong>Share your link or code</strong>
              <p>Send it to people who&apos;d fit Builders Node.</p>
            </div>
          </div>
          <div className="referral-step">
            <span>2</span>
            <div>
              <strong>They apply with it</strong>
              <p>A link fills the code in for them; a code they can type themselves.</p>
            </div>
          </div>
          <div className="referral-step">
            <span>3</span>
            <div>
              <strong>Track your referrals</strong>
              <p>Everyone who applies with it grows the count above.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
