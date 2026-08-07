import { Check, X } from 'lucide-react';
import { useEffect } from 'react';

/**
 * A confirmation that gets out of the way.
 *
 * Success notices used to render as a panel at the top of the admin dashboard,
 * which pushed the whole page down on every save and then sat there — you had
 * to scroll back up to read the answer to something you did at the bottom.
 *
 * Deliberately not the shadcn/radix toaster that ships with the landing page:
 * its colours come from Tailwind tokens tuned for that page's dark palette, so
 * it reads wrong inside the admin UI, and it would pull radix into the admin
 * bundle for one line of text.
 */
export function Toast({
  message,
  onDismiss,
  duration = 4000,
}: {
  message: string | null;
  onDismiss: () => void;
  /** Milliseconds before it fades on its own. */
  duration?: number;
}) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, duration);
    // Keyed on the message, so a second save while one is showing restarts the
    // clock rather than inheriting the tail of the first one's.
    return () => window.clearTimeout(timer);
  }, [message, duration, onDismiss]);

  if (!message) return null;

  return (
    // polite, not alert: this confirms something the admin just did on purpose,
    // so it shouldn't interrupt whatever a screen reader is in the middle of.
    <div className="toast" role="status" aria-live="polite">
      <span className="toast__icon" aria-hidden="true">
        <Check size={14} />
      </span>
      <span className="toast__text">{message}</span>
      <button className="toast__close" onClick={onDismiss} aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}
