import { useEffect, useState } from 'react';
import { Bed, Check, FileCheck2, Sparkles, Utensils, Waves } from 'lucide-react';
import { apiRequest } from '../lib/api';

type PassData = {
  memberId: string;
  fullName: string;
  membershipStatus: string;
  apartment: { name: string; unitNumber: string | null } | null;
  meals: string | null;
  cleaning: { frequency: string | null; nextCleaning: string | null } | null;
  residencyStatus: string;
  beachClub: 'active' | 'locked';
  issuedAt: string;
};

function memberIdFromLocation(): string | null {
  const parts = window.location.pathname.split('/').filter(Boolean);
  // /pass/:memberId
  if (parts[0] === 'pass' && parts[1]) return parts[1];
  return null;
}

export function Pass() {
  const [data, setData] = useState<PassData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const memberId = memberIdFromLocation();

  useEffect(() => {
    if (!memberId) {
      setError('This pass link is missing an id.');
      return;
    }
    let alive = true;
    apiRequest<PassData>(`/public/pass/${encodeURIComponent(memberId)}`)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Pass not found.'); });
    return () => { alive = false; };
  }, [memberId]);

  if (error) {
    return (
      <div className="pass-page">
        <div className="pass-card pass-card--error">
          <h1>Pass unavailable</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="pass-page">
        <div className="pass-card">
          <p>Loading pass…</p>
        </div>
      </div>
    );
  }

  const avatarInitial = data.fullName.trim().charAt(0).toUpperCase() || '?';
  const residencyOk = data.residencyStatus === 'VERIFIED';
  const beachClubOk = data.beachClub === 'active';

  return (
    <div className="pass-page">
      <div className="pass-card">
        <header className="pass-card__head">
          <span className="pass-card__avatar">{avatarInitial}</span>
          <div className="pass-card__id">
            <strong>{data.fullName}</strong>
            <span>Builders Node · {data.membershipStatus}</span>
          </div>
          {data.apartment?.unitNumber ? (
            <span className="pass-card__unit">#{data.apartment.unitNumber}</span>
          ) : null}
        </header>

        <div className="pass-card__perks">
          {data.apartment ? (
            <div className="pass-perk">
              <span className="pass-perk__icon pass-perk__icon--orange"><Bed size={16} /></span>
              <div className="pass-perk__body">
                <strong>Apartment</strong>
                <span>{data.apartment.name}</span>
              </div>
              <Check size={16} className="pass-perk__ok" />
            </div>
          ) : null}

          {data.meals ? (
            <div className="pass-perk">
              <span className="pass-perk__icon pass-perk__icon--orange"><Utensils size={16} /></span>
              <div className="pass-perk__body">
                <strong>Meals</strong>
                <span>{data.meals}</span>
              </div>
              <Check size={16} className="pass-perk__ok" />
            </div>
          ) : null}

          {data.cleaning?.frequency ? (
            <div className="pass-perk">
              <span className="pass-perk__icon pass-perk__icon--blue"><Sparkles size={16} /></span>
              <div className="pass-perk__body">
                <strong>Cleaning</strong>
                <span>{data.cleaning.frequency}</span>
              </div>
              <Check size={16} className="pass-perk__ok" />
            </div>
          ) : null}

          <div className={`pass-perk${residencyOk ? '' : ' pass-perk--locked'}`}>
            <span className="pass-perk__icon pass-perk__icon--orange"><FileCheck2 size={16} /></span>
            <div className="pass-perk__body">
              <strong>E-Residency</strong>
              <span>{residencyOk ? 'Verified' : 'Not verified'}</span>
            </div>
            {residencyOk ? <Check size={16} className="pass-perk__ok" /> : null}
          </div>

          <div className={`pass-perk${beachClubOk ? '' : ' pass-perk--locked'}`}>
            <span className="pass-perk__icon pass-perk__icon--blue"><Waves size={16} /></span>
            <div className="pass-perk__body">
              <strong>Beach Club</strong>
              <span>{beachClubOk ? 'Active' : 'Locked — needs verified residency'}</span>
            </div>
            {beachClubOk ? <Check size={16} className="pass-perk__ok" /> : null}
          </div>
        </div>

        <footer className="pass-card__foot">
          <span>Pass ID · {data.memberId.slice(0, 8)}</span>
          <span>Issued {new Date(data.issuedAt).toLocaleString()}</span>
        </footer>
      </div>
    </div>
  );
}
