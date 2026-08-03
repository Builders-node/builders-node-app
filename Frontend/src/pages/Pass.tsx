import { useEffect, useState } from 'react';
import { Check, ShieldCheck, ShieldX, X } from 'lucide-react';
import { apiRequest } from '../lib/api';

type AccessRow = { key: string; label: string; granted: boolean; detail: string };

type PassData =
  | {
      valid: true;
      fullName: string;
      membershipStatus: string;
      unitNumber: string | null;
      memberSince: string;
      access: AccessRow[];
      checkedAt: string;
    }
  | {
      valid: false;
      reason: string;
      fullName?: string;
      membershipStatus?: string;
      checkedAt: string;
    };

function tokenFromLocation(): string | null {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[0] === 'pass' && parts[1] ? parts[1] : null;
}

export function Pass() {
  const [data, setData] = useState<PassData | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Ticking clock — a screenshot of someone else's pass freezes, so whoever is
  // checking can tell at a glance that they're looking at a live screen.
  const [now, setNow] = useState(() => new Date());
  const token = tokenFromLocation();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!token) {
      setError('This pass link is missing its code.');
      return;
    }
    let alive = true;
    apiRequest<PassData>(`/public/pass/${encodeURIComponent(token)}`)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Could not check this pass.'); });
    return () => { alive = false; };
  }, [token]);

  const clock = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const day = now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

  if (error || (data && !data.valid)) {
    const reason = error ?? (data && !data.valid ? data.reason : '');
    const name = data && !data.valid ? data.fullName : undefined;
    return (
      <div className="pass-page pass-page--invalid">
        <div className="pass-card">
          <div className="pass-verdict pass-verdict--invalid">
            <ShieldX size={26} />
            <div>
              <strong>Not valid</strong>
              <span>{reason}</span>
            </div>
          </div>
          {name ? (
            <div className="pass-card__head">
              <span className="pass-card__avatar pass-card__avatar--muted">{name.trim().charAt(0).toUpperCase()}</span>
              <div className="pass-card__id">
                <strong>{name}</strong>
                <span>{data && !data.valid ? data.membershipStatus ?? '—' : '—'}</span>
              </div>
            </div>
          ) : null}
          <footer className="pass-card__foot">
            <span>Checked {day}</span>
            <span className="pass-clock">{clock}</span>
          </footer>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="pass-page">
        <div className="pass-card"><p>Checking pass…</p></div>
      </div>
    );
  }

  const since = new Date(data.memberSince).toLocaleDateString([], { month: 'short', year: 'numeric' });

  return (
    <div className="pass-page">
      <div className="pass-card">
        <div className="pass-verdict pass-verdict--valid">
          <ShieldCheck size={26} />
          <div>
            <strong>Active member</strong>
            <span>Access confirmed</span>
          </div>
        </div>

        <div className="pass-card__head">
          <span className="pass-card__avatar">{data.fullName.trim().charAt(0).toUpperCase() || '?'}</span>
          <div className="pass-card__id">
            <strong>{data.fullName}</strong>
            <span>Member since {since}</span>
          </div>
          {data.unitNumber ? <span className="pass-card__unit">#{data.unitNumber}</span> : null}
        </div>

        <div className="pass-card__perks">
          {data.access.map((row) => (
            <div className={row.granted ? 'pass-perk' : 'pass-perk pass-perk--locked'} key={row.key}>
              <span className={row.granted ? 'pass-perk__mark pass-perk__mark--yes' : 'pass-perk__mark pass-perk__mark--no'}>
                {row.granted ? <Check size={14} /> : <X size={14} />}
              </span>
              <div className="pass-perk__body">
                <strong>{row.label}</strong>
                <span>{row.detail}</span>
              </div>
            </div>
          ))}
        </div>

        <footer className="pass-card__foot">
          <span>Checked {day}</span>
          <span className="pass-clock">{clock}</span>
        </footer>
      </div>
    </div>
  );
}
