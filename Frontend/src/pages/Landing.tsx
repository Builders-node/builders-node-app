import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
import { BatchProvider } from '@/lib/batch';
import { ApplyNavProvider, AccountNavProvider } from '@/lib/applyNav';
import type { PageId } from '../data/dashboard';

type LandingProps = {
  setActivePage: (page: PageId) => void;
  currentUserId?: string | null;
};

const queryClient = new QueryClient();

export function Landing({ setActivePage, currentUserId }: LandingProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TooltipProvider>
          <BatchProvider>
          <ApplyNavProvider openApply={() => setActivePage('apply')}>
          <AccountNavProvider
            value={{
              currentUserId: currentUserId ?? null,
              openAccount: () => setActivePage('profile'),
              openLogin: () => setActivePage('login'),
            }}
          >
          <div className="landing-root min-h-screen" style={{ backgroundColor: 'hsl(30 30% 93%)', color: 'hsl(0 0% 10%)' }}>
            <Navbar />
            <HeroSection />
            <MissionSection />
            <PartnersSection />
            <AboutSection />
            <GallerySection />
            <AdvantagesSection />
            <TwitterSection />
            <SpeakersSection />
            <EventsSection />
            <FAQSection />
            <Footer />
          </div>
          </AccountNavProvider>
          </ApplyNavProvider>
          </BatchProvider>
          <Toaster />
          <Sonner />
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
