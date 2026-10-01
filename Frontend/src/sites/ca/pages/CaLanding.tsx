import { useRef } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import MissionSection from '@/components/MissionSection';
import PartnersSection from '@/components/PartnersSection';
import AboutSection from '@/components/AboutSection';
import AdvantagesSection from '@/components/AdvantagesSection';
import TwitterSection from '@/components/TwitterSection';
import SpeakersSection from '@/components/SpeakersSection';
import EventsSection from '@/components/EventsSection';
import FAQSection from '@/components/FAQSection';
import Footer from '@/components/Footer';
import { ApplyNavProvider, AccountNavProvider } from '@/lib/applyNav';
import CaNavbar from '../components/CaNavbar';
import CaHeroSection from '../components/CaHeroSection';
import CaGallerySection from '../components/CaGallerySection';
import { GuideSection } from '../components/GuideSection';
import { applyUrl, mainSiteUrl } from '../site';

/**
 * The CA landing page.
 *
 * Starts as the apex site's landing, section for section, and is free to stop
 * being that. Add, remove or reorder anything below; write sections of its own
 * under `src/sites/ca/` when the shared ones stop fitting. Nothing here is
 * imported by the main site, so it cannot break it.
 *
 * Two things to keep. Every call to action that isn't the guide leaves for the
 * apex domain — the shared sections don't know that, they call `useApplyNav()`
 * / `useAccountNav()` and the providers below decide what it means, which is
 * why they can be reused unchanged. And the guide form is the one thing that
 * stays here: it takes an address, not an application.
 *
 * No Telegram anywhere on this page, deliberately — neither the hero button nor
 * the floating one. This landing asks for exactly one thing.
 */
export function CaLanding() {
  const guideRef = useRef<HTMLElement>(null);
  const scrollToGuide = () => guideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

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
              <CaNavbar />
              <CaHeroSection onRequestGuide={scrollToGuide} />
              <AboutSection />
              <CaGallerySection onRequestGuide={scrollToGuide} />
              <AdvantagesSection />
              <MissionSection />
              <PartnersSection />
              <TwitterSection />
              <SpeakersSection />
              <EventsSection />
              <FAQSection />
              {/* Last thing before the footer: by here they've read the page
                  and the ask has been in the header the whole way down. */}
              <GuideSection ref={guideRef} />
              <Footer />
            </div>
          </AccountNavProvider>
        </ApplyNavProvider>
        <Toaster />
        <Sonner />
      </TooltipProvider>
    </MemoryRouter>
  );
}
