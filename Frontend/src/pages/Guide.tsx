import { GuideGate } from '@/components/GuideGate';

/**
 * The guide gate on the main site, at /guide. Not linked from anywhere on the
 * site: it is reached through links sent by hand, usually with `?key=`. It opens the guide whose section 05
 * covers getting here from anywhere, not just Canada.
 */
export function Guide() {
  return <GuideGate site="main" homeHref="/" applyHref="/apply?src=guide" />;
}
