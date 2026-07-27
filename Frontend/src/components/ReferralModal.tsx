import { Check, Copy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';

type ReferralModalProps = {
  userId: string;
  inviteLink: string;
  onClose: () => void;
};

export function ReferralModal({ userId, inviteLink, onClose }: ReferralModalProps) {
  const [count, setCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiRequest<{ referredCount: number }>(`/users/${userId}/referrals`)
      .then((data) => setCount(data.referredCount))
      .catch(() => setCount(null));
  }, [userId]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
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
          Share your link — when someone applies to Builders Node with it, they&apos;re counted as your referral.
        </p>

        <div className="referral-modal__link">
          <input value={inviteLink} readOnly aria-label="Your invite link" onFocus={(event) => event.currentTarget.select()} />
        </div>
        <button className="primary-button referral-modal__copy" onClick={() => void copy()}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Copied' : 'Copy link'}
        </button>

        <div className="referral-modal__stat">
          <strong>{count ?? '—'}</strong>
          <span>{count === 1 ? 'person has' : 'people have'} joined via your link</span>
        </div>

        <div className="referral-modal__steps">
          <div className="referral-step">
            <span>1</span>
            <div>
              <strong>Copy &amp; share your link</strong>
              <p>Send it to people who&apos;d fit Builders Node.</p>
            </div>
          </div>
          <div className="referral-step">
            <span>2</span>
            <div>
              <strong>They apply with your link</strong>
              <p>Your code is attached to their application.</p>
            </div>
          </div>
          <div className="referral-step">
            <span>3</span>
            <div>
              <strong>Track your referrals</strong>
              <p>Everyone who applies via your link grows the count above.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
