import { GuideGate } from '@/components/GuideGate';

/**
 * The guide gate on the main site, at /guide — the page the header links to,
 * and the one a `?key=` link lands on. It opens the guide whose section 05
 * covers getting here from anywhere, not just Canada.
 */
export function Guide() {
  return <GuideGate site="main" homeHref="/" applyHref="/apply?src=guide" />;
}
