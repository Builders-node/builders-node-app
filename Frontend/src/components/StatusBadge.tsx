import type { StatusTone } from '../data/dashboard';

type StatusBadgeProps = {
  children: string;
  tone?: StatusTone;
};

export function StatusBadge({ children, tone = 'neutral' }: StatusBadgeProps) {
  return <span className={`status-badge status-badge--${tone}`}>{children}</span>;
}
