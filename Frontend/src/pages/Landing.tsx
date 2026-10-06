import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/HeroSection';
import MissionSection from '@/components/MissionSection';
import AboutSection from '@/components/AboutSection';
import GallerySection from '@/components/GallerySection';
import TwitterSection from '@/components/TwitterSection';
import FAQSection from '@/components/FAQSection';
import Footer from '@/components/Footer';
import WhereYouLiveSection from '@/components/WhereYouLiveSection';
import PricingSection from '@/components/PricingSection';
import { MAIN_GALLERY_ITEMS } from '@/components/MainGalleryItems';
import WeekSection from '@/components/WeekSection';
import { GuideCta } from '@/sites/ca/components/GuideCta';
import { ApplyNavProvider, AccountNavProvider } from '@/lib/applyNav';
import type { PageId } from '../data/dashboard';

/** Tweets the main landing leaves out; the CA site shows them all. */
const MAIN_HIDDEN_TWEETS = ['@anna9vakh', '@techno0ptimist', '@erickbrimen', '@aubreydegrey', '@ThatMrE'];

/** Governance cards whose second paragraph the main landing drops. */
const MAIN_GOVERNANCE_TEXT = {
  'Start your business faster':
    "Register and launch your business in as little as 40 minutes using Próspera's regulatory sandbox.",
  'Low, competitive taxes': 'A simplified tax system with rates as low as 1%–5% and minimal reporting.',
};

type LandingProps = {
  setActivePage: (page: PageId) => void;
  currentUserId?: string | null;
};

export function Landing({ setActivePage, currentUserId }: LandingProps) {
  return (
    <TooltipProvider>
      <ApplyNavProvider openApply={() => setActivePage('apply')}>
      <AccountNavProvider
        value={{
          currentUserId: currentUserId ?? null,
          openAccount: () => setActivePage('profile'),
          openLogin: () => setActivePage('login'),
          openAffiliate: () => setActivePage('affiliate'),
        }}
      >
      <div className="landing-root min-h-screen" style={{ backgroundColor: 'hsl(30 30% 93%)', color: 'hsl(0 0% 10%)' }}>
        <Navbar />
        <HeroSection />
        <GuideCta
          site="main"
          heading="Get the Builders Node guide: pricing, daily life, Próspera, and how to get here."
          description={null}
        />
        <AboutSection
          statement="What Builders Node is"
          body="A coliving community where founders, builders and creators live in the same tower for 1-3 months, work on their own projects, and share dinners, sport and weekends."
          showLearnMore={false}
        />
        <PricingSection />
        <WeekSection />
        <GallerySection items={MAIN_GALLERY_ITEMS} />
        <MissionSection
          showCommunity={false}
          showStartups={false}
          governanceText={MAIN_GOVERNANCE_TEXT}
          hideGovernance={['Flexible regulatory framework']}
        />
        <TwitterSection hide={MAIN_HIDDEN_TWEETS} />
        <WhereYouLiveSection />
        <FAQSection />
        <Footer showEvents={false} comeBuild />
        {/* Outside the page flow on purpose — it follows the visitor down
            the page rather than waiting in a section they may not reach. */}
      </div>
      </AccountNavProvider>
      </ApplyNavProvider>
      <Toaster />
    </TooltipProvider>
  );
}
