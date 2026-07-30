import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

// Distance the user must pull past the trigger point before releasing counts as
// a refresh. Feels right on iPhone: ~half a thumb-drag.
const THRESHOLD_PX = 70;
// Rubber-band factor so pulls slow down after the threshold (feels natural).
const DAMPING = 0.55;
const MAX_PULL_PX = 130;

/**
 * Mobile pull-to-refresh, only active when the app is installed as a PWA
 * (display-mode: standalone) OR opened on a touch device where the native
 * chrome-based pull is unreliable. Pulling down from the very top of the page
 * far enough triggers a full reload — the simplest way to guarantee every
 * screen re-fetches its data.
 */
export function PullToRefresh() {
  const [pull, setPull] = useState(0); // current visible pull distance, px
  const [triggering, setTriggering] = useState(false); // released past threshold — spin + reload
  const [armed, setArmed] = useState(false); // is this platform even eligible

  const startY = useRef<number | null>(null);
  const activeTouch = useRef(false);

  // Only arm on standalone PWA or coarse-pointer devices (mobile). Also skip
  // when running desktop-in-a-window; there's no gesture for it there.
  useEffect(() => {
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    const isTouch = window.matchMedia?.('(hover: none) and (pointer: coarse)').matches;
    setArmed(Boolean(isStandalone || isTouch));
  }, []);

  useEffect(() => {
    if (!armed) return;

    // A pull that starts on top of an open modal / dropdown / scrollable inner
    // container should be ignored — otherwise a swipe inside a bottom-sheet
    // would kick off a page reload.
    function shouldIgnoreTarget(target: EventTarget | null): boolean {
      if (!(target instanceof Element)) return false;
      return Boolean(
        target.closest(
          '.modal-overlay, .admin-sheet-overlay, .notif-dropdown, .account-dropdown, [role="dialog"]',
        ),
      );
    }

    function onTouchStart(event: TouchEvent) {
      if (event.touches.length !== 1) return;
      if (window.scrollY > 0) return;
      if (shouldIgnoreTarget(event.target)) return;
      startY.current = event.touches[0].clientY;
      activeTouch.current = true;
    }

    function onTouchMove(event: TouchEvent) {
      if (!activeTouch.current || startY.current == null) return;
      const delta = event.touches[0].clientY - startY.current;
      if (delta <= 0) {
        // Scrolling up — cancel any pull we started tracking.
        if (pull > 0) setPull(0);
        return;
      }
      // The bar becomes visible only after a small initial drag so accidental
      // taps aren't shown as a pull.
      const damped = Math.min(MAX_PULL_PX, delta * DAMPING);
      if (damped > 4) {
        // Consume the gesture — otherwise the browser tries to scroll/bounce.
        event.preventDefault();
        setPull(damped);
      }
    }

    function onTouchEnd() {
      if (!activeTouch.current) return;
      activeTouch.current = false;
      startY.current = null;
      if (pull >= THRESHOLD_PX) {
        setTriggering(true);
        // Give the spinner one frame to show, then reload.
        setTimeout(() => window.location.reload(), 120);
      } else {
        setPull(0);
      }
    }

    // touchmove must be non-passive so we can preventDefault; React's onTouchMove
    // is passive by default in modern browsers, so we bind manually.
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [armed, pull]);

  if (!armed) return null;
  const progress = Math.min(1, pull / THRESHOLD_PX);
  const visible = pull > 4 || triggering;

  return (
    <div
      className={`ptr${triggering ? ' ptr--triggering' : ''}`}
      aria-hidden={!visible}
      style={{
        transform: `translate(-50%, ${triggering ? 24 : Math.max(-40, pull - 40)}px)`,
        opacity: visible ? 1 : 0,
      }}
    >
      <RefreshCw
        size={18}
        style={{
          transform: `rotate(${triggering ? 0 : progress * 220}deg)`,
          transition: triggering ? 'none' : 'transform 0.05s linear',
        }}
      />
    </div>
  );
}
