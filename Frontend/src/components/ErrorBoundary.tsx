import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { failed: boolean };

/**
 * Last line of defence against a blank page.
 *
 * Without a boundary, any render error — or a lazy page whose chunk fails to
 * load — unmounts the whole tree and leaves an empty white screen with no way
 * out but a refresh the visitor has no reason to try. The commonest cause is a
 * deploy landing while a tab is open: the old build asks for a chunk that no
 * longer exists. main.tsx already reloads once on that (`vite:preloadError`);
 * this catches whatever gets past it, and everything else besides.
 *
 * Styled inline rather than with Tailwind or styles.css so it renders the same
 * on the main app, the landing and the CA site, whose stylesheets differ.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Still reach the console, so the cause isn't swallowed along with the crash.
    console.error('Render error caught by ErrorBoundary', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Something went wrong.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            minHeight: 44,
            padding: '0 20px',
            border: 0,
            borderRadius: 999,
            background: '#EA5404',
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
