import { ArrowRight } from "lucide-react";
import { useGsapTitle } from "@/hooks/useGsapTitle";
import { useApplyNav } from "@/lib/applyNav";

type CaHeroSectionProps = {
  /** Scrolls to the guide form. The page owns the ref, so it passes this down. */
  onRequestGuide: () => void;
};

const CaHeroSection = ({ onRequestGuide }: CaHeroSectionProps) => {
  const openApply = useApplyNav();
  const titleRef = useGsapTitle<HTMLHeadingElement>();

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
        {/* The offer up top, what the month is actually like underneath — and
            no price: the guide block right below is what this landing asks for. */}
        <h1 ref={titleRef} className="text-4xl sm:text-5xl md:text-6xl lg:text-[4.75rem] font-light leading-[1.05] text-white max-w-4xl tracking-tight">
          Spend the winter at Builders Node.
        </h1>
        <p className="text-base md:text-lg text-white/70 max-w-2xl leading-relaxed">
          A community of founders on a Caribbean island. Work on your project, learn, and meet like-minded people while
          we handle the day-to-day.
        </p>
        {/* Two ways in, ranked. The guide is the cheap first step and the ask
            this landing is built around; applying is the commitment, so it sits
            alongside as an outline rather than competing as a second filled
            button. */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onRequestGuide}
            className="inline-flex items-center gap-2 text-white text-xs tracking-[0.25em] uppercase font-semibold rounded-full px-6 py-3 transition-all duration-300 hover:scale-105 cursor-pointer border-none"
            style={{ backgroundColor: "#EA5404", boxShadow: "0 10px 28px rgba(234, 84, 4, 0.5)" }}
          >
            Send me guide
            <ArrowRight size={14} aria-hidden="true" />
          </button>
          <button
            onClick={openApply}
            className="inline-flex items-center gap-2 text-xs tracking-[0.25em] uppercase font-semibold rounded-full px-6 py-3 border border-white/40 bg-white/5 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-white/10 cursor-pointer"
            /* Inline, not `text-white`: `.landing-root button` inherits the
               page's dark text colour, which is invisible on a dark photo. */
            style={{ color: "#fff" }}
          >
            Apply now
          </button>
        </div>
      </div>
    </section>
  );
};
export default CaHeroSection;
