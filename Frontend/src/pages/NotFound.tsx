import type { MouseEvent } from 'react';
import logo from '@/assets/logo.svg';
import type { PageId } from '../data/dashboard';

type NotFoundProps = {
  setActivePage: (page: PageId) => void;
  currentUserId?: string | null;
};

/**
 * Any path the app doesn't know.
 *
 * It used to render the landing and quietly rewrite the address to '/', which
 * hid broken links from everybody: the visitor never learned the link was
 * wrong, and a crawler indexed one homepage under every typo. App.tsx keeps
 * the URL as typed and marks the view noindex while it is up; this only has to
 * say so and offer a way back.
 *
 * The links are real anchors so they can be opened in a new tab, intercepted
 * for an in-app navigation otherwise.
 */
export function NotFound({ setActivePage, currentUserId }: NotFoundProps) {
  const home: PageId = currentUserId ? 'profile' : 'landing';
  const go = (event: MouseEvent<HTMLAnchorElement>, page: PageId) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    setActivePage(page);
  };

  return (
    <div
      className="landing-root"
      style={{ minHeight: '100vh', backgroundColor: 'hsl(30 30% 96%)', color: 'hsl(0 0% 10%)' }}
    >
      <header className="border-b" style={{ borderColor: 'hsl(0 0% 88%)' }}>
        <div className="flex items-center px-6 sm:px-10 md:px-12" style={{ height: 68 }}>
          <a href={currentUserId ? '/account' : '/'} onClick={(e) => go(e, home)} aria-label="Builders Node home">
            <img src={logo} alt="Builders Node" className="h-6 w-auto" />
          </a>
        </div>
      </header>

      <main className="px-6 sm:px-10 md:px-12 pb-28 pt-16 sm:pt-24">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-xs tracking-[0.25em] uppercase mb-5" style={{ color: 'hsl(0 0% 45%)' }}>
            404
          </p>
          <h1 className="text-4xl sm:text-5xl font-light tracking-tight leading-[1.05]">Page not found</h1>
          <p className="mt-6 text-base md:text-lg leading-relaxed" style={{ color: 'hsl(0 0% 40%)' }}>
            The link may be mistyped, or the page has moved.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href={currentUserId ? '/account' : '/'}
              onClick={(e) => go(e, home)}
              className="inline-flex items-center h-12 px-7 text-xs tracking-[0.25em] uppercase font-semibold rounded-full no-underline"
              style={{ backgroundColor: 'hsl(0 0% 10%)', color: 'hsl(30 30% 96%)' }}
            >
              {currentUserId ? 'Go to your account' : 'Go to the homepage'}
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
