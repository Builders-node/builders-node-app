import { GuideGate } from '@/components/GuideGate';
import { CA_PATHS, applyUrl, caHref } from '../site';

/** The guide gate on this site — it opens the guide with "Getting here from Canada". */
export function CaGuide() {
  return <GuideGate site="ca" homeHref={caHref(CA_PATHS.landing)} applyHref={applyUrl()} />;
}
