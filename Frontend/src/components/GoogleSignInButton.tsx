import { useEffect, useRef } from 'react';

// Loads Google Identity Services once and hands back the ID token (credential).
const GSI_SRC = 'https://accounts.google.com/gsi/client';
let gsiPromise: Promise<void> | null = null;

function loadGsi(): Promise<void> {
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google sign-in.'));
    document.head.appendChild(script);
  });
  return gsiPromise;
}

type GoogleSignInButtonProps = {
  onCredential: (credential: string) => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
};

export function GoogleSignInButton({ onCredential, text = 'continue_with' }: GoogleSignInButtonProps) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;

  useEffect(() => {
    if (!clientId || !containerRef.current) return;
    let cancelled = false;

    loadGsi()
      .then(() => {
        const container = containerRef.current;
        if (cancelled || !container || !window.google?.accounts?.id) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: { credential?: string }) => {
            if (response.credential) callbackRef.current(response.credential);
          },
        });

        const width = Math.min(400, Math.max(200, container.offsetWidth || 320));
        container.innerHTML = '';
        window.google.accounts.id.renderButton(container, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          shape: 'rectangular',
          logo_alignment: 'center',
          width,
        });
      })
      .catch(() => {
        /* leave the area empty if Google fails to load */
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, text]);

  /**
   * Hiding the button when there's no client ID is right for visitors — a dead
   * Google button is worse than none. But it makes an unconfigured setup look
   * identical to a working one, so say so where only developers will see it.
   */
  useEffect(() => {
    if (!clientId && import.meta.env.DEV) {
      console.warn(
        '[GoogleSignInButton] VITE_GOOGLE_CLIENT_ID is not set — the Google button is hidden. ' +
          'See Frontend/.env.example; the same value must also be set as GOOGLE_CLIENT_ID on the API.',
      );
    }
  }, [clientId]);

  // Nothing to show until a Google client ID is configured.
  if (!clientId) return null;

  return <div ref={containerRef} className="google-signin" />;
}
