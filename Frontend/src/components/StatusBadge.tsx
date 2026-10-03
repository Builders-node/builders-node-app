import type { StatusTone } from '../data/dashboard';
import { isStatusCode, statusLabel } from '../lib/statusLabels';

type StatusBadgeProps = {
  children: string;
  tone?: StatusTone;
};

/**
 * A raw status code passed as the text ("FIRST_APPROVED") is shown as its
 * label ("First check passed"), so call sites can hand over `app.status`
 * directly. Prose and numbers ("Setup required", "12") are left alone.
 */
export function StatusBadge({ children, tone = 'neutral' }: StatusBadgeProps) {
  const text = isStatusCode(children) ? statusLabel(children) : children;
  return <span className={`status-badge status-badge--${tone}`}>{text}</span>;
}
