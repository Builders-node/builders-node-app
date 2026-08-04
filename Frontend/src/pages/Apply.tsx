import { useEffect, useState } from 'react';
import ApplyForm from '@/components/ApplyForm';
import { Toaster } from '@/components/ui/toaster';
import { BatchProvider } from '@/lib/batch';
import logo from '@/assets/logo.svg';
import featRoom from '@/assets/adv-room.jpg';
import featMeals from '@/assets/apply-food.webp';
import featGym from '@/assets/gallery-3.jpg';
import featSpeakers from '@/assets/balaji-srinivasan.webp';
import featCommunity from '@/assets/gallery-9.webp';
import featCoworking from '@/assets/adv-coworking.jpg';
import { apiRequest } from '../lib/api';
import type { PageId } from '../data/dashboard';

type ApplyProps = {
  currentUserId: string | null;
  /** Kept for prop compatibility; routing no longer branches on role here. */
  currentUserRole?: string | null;
  setActivePage: (page: PageId) => void;
  setCurrentUserId?: (userId: string | null) => void;
  setCurrentUserRole?: (role: string | null) => void;
};

const features = [
  { img: featRoom, label: 'Serviced room' },
  { img: featMeals, label: 'Healthy meals' },
  { img: featGym, label: '24/7 gym' },
  { img: featSpeakers, label: 'World-class speakers' },
  { img: featCommunity, label: 'Community' },
  { img: featCoworking, label: '24/7 coworking' },
];

export function Apply({ currentUserId, setActivePage, setCurrentUserId, setCurrentUserRole }: ApplyProps) {
  const [prefill, setPrefill] = useState<{ email?: string; fullName?: string }>({});
  const [done, setDone] = useState(false);

  // Called when the applicant sets a password and their account is created —
  // sign them in so the success screen (and the app) treat them as logged in.
  const onAuthenticated = (session: { accessToken: string; user: { id: string; role: string } }) => {
    localStorage.setItem('terminus_access_token', session.accessToken);
    setCurrentUserId?.(session.user.id);
    setCurrentUserRole?.(session.user.role);
  };
  const avatarInitial = (prefill.fullName || prefill.email || 'A').trim().charAt(0).toUpperCase();

  // Logo: guest → landing; logged in → their profile (signed-in home).
  const logoTarget: PageId = !currentUserId ? 'landing' : 'profile';

  useEffect(() => {
    if (!currentUserId) return;
    apiRequest<{ account: { email: string; fullName?: string | null } }>(`/users/${currentUserId}/home`)
      .then((home) => setPrefill({ email: home.account.email, fullName: home.account.fullName ?? '' }))
      .catch(() => {
        /* no prefill on failure */
      });
  }, [currentUserId]);

  const goHome = () => setActivePage(currentUserId ? 'profile' : 'landing');

  return (
    <BatchProvider>
      <div className="landing-root" style={{ minHeight: '100vh', backgroundColor: 'hsl(30 30% 96%)', color: 'hsl(0 0% 10%)' }}>
        {/* Top nav */}
        <header className="border-b" style={{ borderColor: 'hsl(0 0% 88%)', backgroundColor: 'hsl(30 30% 96%)' }}>
          <div className="flex items-center justify-between px-6 sm:px-10 md:px-12" style={{ height: 68 }}>
            <button type="button" onClick={() => setActivePage(logoTarget)} className="flex items-center" aria-label="Builders Node home">
              <img src={logo} alt="Builders Node" className="h-6 w-auto" />
            </button>
            {currentUserId ? (
              <button
                type="button"
                onClick={() => setActivePage('profile')}
                aria-label="Open your account"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: '#FBE3D3',
                  color: '#EA5404',
                  fontWeight: 800,
                  fontSize: 15,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {avatarInitial}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActivePage('login')}
                className="rounded-full px-5 py-2 text-xs tracking-[0.15em] uppercase font-semibold border transition-colors hover:bg-black/5"
                style={{ borderColor: 'hsl(0 0% 80%)', color: 'hsl(0 0% 10%)' }}
              >
                Log in
              </button>
            )}
          </div>
        </header>

        <main className="px-6 sm:px-10 md:px-12 pb-28 pt-10 sm:pt-14">
          <div className="max-w-5xl mx-auto">
            {done ? (
              <div className="py-10 max-w-3xl mx-auto">
                <h1 className="text-4xl sm:text-5xl font-light tracking-tight leading-[1.05]">Application received</h1>
                <p className="mt-5 text-base md:text-lg max-w-xl" style={{ color: 'hsl(0 0% 40%)' }}>
                  Thanks — we&apos;ll review your application and get back to you soon.
                </p>
                <button
                  type="button"
                  onClick={goHome}
                  className="mt-8 h-12 px-7 text-sm tracking-[0.15em] uppercase font-medium rounded-lg"
                  style={{ backgroundColor: 'hsl(0 0% 10%)', color: 'hsl(30 30% 96%)' }}
                >
                  {currentUserId ? 'Back to dashboard' : 'Back to home'}
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tight leading-[1.05]">Apply to Builders Node</h1>
                <p className="mt-4 max-w-2xl text-base md:text-lg leading-relaxed" style={{ color: 'hsl(0 0% 40%)' }}>
                  Builders Node is a startup society for builders, founders, and content creators. Located in Próspera, we provide all this for just $1,950/mo:
                </p>

                {/* Feature gallery — auto-scrolling marquee */}
                <div className="apply-marquee mt-8 -mx-6 sm:-mx-10 md:-mx-12">
                  <div className="apply-marquee-track">
                    {[...features, ...features].map((feature, index) => (
                      <div key={`${feature.label}-${index}`} className="relative flex-shrink-0 w-60 sm:w-64 h-56 sm:h-64 rounded-2xl overflow-hidden">
                        <img src={feature.img} alt={feature.label} className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.05) 45%)' }} />
                        <span className="absolute top-5 left-0 right-0 text-center text-white text-lg sm:text-xl font-medium px-3">{feature.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Form */}
                <div className="mt-12 max-w-3xl mx-auto">
                  <ApplyForm initialEmail={prefill.email} initialFullName={prefill.fullName} onSuccess={() => setDone(true)} onAuthenticated={onAuthenticated} />
                </div>
              </>
            )}
          </div>
        </main>
      </div>
      <Toaster />
    </BatchProvider>
  );
}
