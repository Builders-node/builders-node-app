import { useGsapTitle } from "@/hooks/useGsapTitle";
import { useBatch } from "@/lib/batch";
import { useApplyNav } from "@/lib/applyNav";

const HeroSection = () => {
  const openApply = useApplyNav();
  const titleRef = useGsapTitle<HTMLHeadingElement>();
  const batch = useBatch();
  const badgeText = batch.label ?? `First Batch · Starting ${batch.longDate ?? "September 1, 2026"}`;
  const arrivalText = batch.monthDay ?? "September 1";

  return (
    <section
      id="home"
      className="relative min-h-screen flex items-end overflow-hidden"
    >
      {/* Background poster fallback (shown until video plays / when video unsupported) */}
      <div
        className="absolute inset-0 w-full h-full bg-black bg-cover bg-center"
        style={{ backgroundImage: "url('/media/hero-poster.jpg')" }}
      />

      {/* Background video */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/media/hero-poster.jpg"
        className="absolute inset-0 w-full h-full object-cover"
      >
        {/* H.264 first — universal support (iOS Safari, older Android) */}
        <source src="/media/hero.mp4" type="video/mp4; codecs=avc1.42E01E" />
        {/* AV1 fallback for modern desktop browsers */}
        <source
          src="https://v20uliacxvh3bj6g.public.blob.vercel-storage.com/hero_web_av1-6GILWV8N0A8yXV3Nb9Tlv9DYjItjnW.mp4"
          type="video/mp4; codecs=av01.0.05M.08"
        />
      </video>


      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Main content — bottom-left */}
      <div className="relative z-10 w-full px-8 md:px-12 pb-28 md:pb-32 flex flex-col gap-6">
        <span className="inline-flex items-center gap-2 self-start text-[10px] md:text-xs tracking-[0.25em] uppercase text-white px-3 py-1.5 rounded-full border border-white/40 backdrop-blur-sm bg-white/5">
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(15_85%_55%)] animate-pulse" />
          {badgeText}
        </span>
        <h1 ref={titleRef} className="text-4xl sm:text-5xl md:text-6xl lg:text-[5.5rem] font-light leading-[1.05] text-white max-w-6xl tracking-tight">
          Builders Node <br />in Prospera
        </h1>
        <p className="text-base md:text-lg text-white/70 max-w-xl leading-relaxed">
          First arrivals from {arrivalText} — $1,950/mo including accommodation, gym, food, co-working, and more.
        </p>
      </div>

      {/* Bottom-right CTA */}
      <div className="absolute bottom-8 left-8 md:bottom-12 md:left-12 z-10 flex items-center gap-3">
        <button
          onClick={openApply}
          className="text-white text-xs tracking-[0.25em] uppercase font-semibold rounded-full px-6 py-3 transition-all duration-300 hover:scale-105 cursor-pointer border-none"
          style={{ backgroundColor: "#EA5404", boxShadow: "0 10px 28px rgba(234, 84, 4, 0.5)" }}
        >
          APPLY NOW
        </button>
      </div>
    </section>
  );
};
export default HeroSection;
