import { useGsapTitle } from "@/hooks/useGsapTitle";
import { useBatch } from "@/lib/batch";
import { useApplyNav } from "@/lib/applyNav";

const HeroSection = () => {
  const openApply = useApplyNav();
  const titleRef = useGsapTitle<HTMLHeadingElement>();
  const batch = useBatch();
  const badgeText = batch.label ?? `First Batch · Starting ${batch.longDate}`;

  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
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

      {/* Main content — centered */}
      <div className="relative z-10 w-full px-6 md:px-12 flex flex-col items-center text-center gap-6">
        {/* Held hidden (not unmounted) until the real batch date arrives: it keeps
            its place in the layout, so the headline doesn't jump, and the visitor
            never reads a date that's about to be corrected.
            `visibility` rather than an animated opacity on purpose — a tab opened
            in the background has its transitions frozen, and a fade that never
            runs would leave the badge invisible for good. */}
        <span
          className={`inline-flex items-center gap-2 text-[10px] md:text-xs tracking-[0.25em] uppercase text-white px-3 py-1.5 rounded-full border border-white/40 backdrop-blur-sm bg-white/5 ${
            batch.isLoaded ? "visible" : "invisible"
          }`}
          aria-hidden={!batch.isLoaded}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(15_85%_55%)] animate-pulse" />
          {badgeText}
        </span>
        <h1 ref={titleRef} className="text-4xl sm:text-5xl md:text-6xl lg:text-[5.5rem] font-light leading-[1.05] text-white max-w-6xl tracking-tight">
          Come to build. <br />Stay for the people
        </h1>
        <p className="text-base md:text-lg text-white/70 max-w-xl leading-relaxed">
          $1,950/month and includes private accommodation, nutritious meals, coworking, gym, pool and more.
        </p>
        <button
          onClick={openApply}
          className="mt-2 text-white text-xs tracking-[0.25em] uppercase font-semibold rounded-full px-6 py-3 transition-all duration-300 hover:scale-105 cursor-pointer border-none"
          style={{ backgroundColor: "#EA5404", boxShadow: "0 10px 28px rgba(234, 84, 4, 0.5)" }}
        >
          APPLY NOW
        </button>
      </div>
    </section>
  );
};
export default HeroSection;
