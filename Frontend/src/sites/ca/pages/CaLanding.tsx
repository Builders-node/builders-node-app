import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/HeroSection';
import MissionSection from '@/components/MissionSection';
import PartnersSection from '@/components/PartnersSection';
import AboutSection from '@/components/AboutSection';
import GallerySection from '@/components/GallerySection';
import AdvantagesSection from '@/components/AdvantagesSection';
import TwitterSection from '@/components/TwitterSection';
import SpeakersSection from '@/components/SpeakersSection';
import EventsSection from '@/components/EventsSection';
import FAQSection from '@/components/FAQSection';
import Footer from '@/components/Footer';
import TelegramCommunityButton from '@/components/TelegramCommunityButton';
import { ApplyNavProvider, AccountNavProvider } from '@/lib/applyNav';
import { applyUrl, mainSiteUrl } from '../site';

/**
 * The CA landing page.
 *
 * Starts as the apex site's landing, section for section, and is free to stop
 * being that. Add, remove or reorder anything below; write sections of its own
 * under `src/sites/ca/` when the shared ones stop fitting. Nothing here is
 * imported by the main site, so it cannot break it.
 *
 * The one thing to keep: every call to action leaves for the apex domain. The
 * sections don't know that — they call `useApplyNav()` / `useAccountNav()` and
 * the providers below decide what that means, which is why they can be reused
 * unchanged.
 */
export function CaLanding() {
  const leaveFor = (url: string) => () => {
    window.location.href = url;
  };

  return (
    <MemoryRouter>
      <TooltipProvider>
        <ApplyNavProvider openApply={leaveFor(applyUrl())}>
          <AccountNavProvider
            value={{
              // Always null: this origin has no session of its own and must not
              // pretend to. Everyone gets "Log in", which goes to the apex
              // domain, where their session actually lives.
              currentUserId: null,
              openAccount: leaveFor(mainSiteUrl('/account')),
              openLogin: leaveFor(mainSiteUrl('/login')),
              openAffiliate: leaveFor(mainSiteUrl('/affiliate')),
            }}
          >
            <div
              className="landing-root min-h-screen"
              style={{ backgroundColor: 'hsl(30 30% 93%)', color: 'hsl(0 0% 10%)' }}
            >
              <Navbar />
              <HeroSection />
              <AboutSection />
              <GallerySection />
              <AdvantagesSection />
              <MissionSection />
              <PartnersSection />
              <TwitterSection />
              <SpeakersSection />
              <EventsSection />
              <FAQSection />
              <Footer />
              <TelegramCommunityButton />
            </div>
          </AccountNavProvider>
        </ApplyNavProvider>
        <Toaster />
        <Sonner />
      </TooltipProvider>
    </MemoryRouter>
  );
}
