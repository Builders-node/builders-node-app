import { useGsapTitle } from "@/hooks/useGsapTitle";
import { HeroVideo } from "@/components/HeroVideo";
import { useApplyNav } from "@/lib/applyNav";

const HeroSection = () => {
  const openApply = useApplyNav();
  const titleRef = useGsapTitle<HTMLHeadingElement>();

  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      <HeroVideo />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Main content — centered */}
      <div className="relative z-10 w-full px-6 md:px-12 flex flex-col items-center text-center gap-6">
        <h1 ref={titleRef} className="text-4xl sm:text-5xl md:text-6xl lg:text-[5.5rem] font-light leading-[1.05] text-white max-w-6xl tracking-tight">
          Coliving in Prospera
        </h1>
        <p className="text-base md:text-lg text-white/70 max-w-xl leading-relaxed">
          Join the founder's community on the Caribbean island only for $999/month
        </p>
        {/* Apply is the ask, filled; the guide sits beside it as an outline
            for the visitor who wants to read first. It scrolls to the guide
            form just below the hero. */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={openApply}
            className="text-white text-xs tracking-[0.25em] uppercase font-semibold rounded-full px-6 py-3 transition-all duration-300 hover:scale-105 cursor-pointer border-none"
            style={{ backgroundColor: "#EA5404", boxShadow: "0 10px 28px rgba(234, 84, 4, 0.5)" }}
          >
            APPLY NOW
          </button>
          <button
            type="button"
            onClick={() =>
              document.querySelector<HTMLElement>("[data-guide-cta]")?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="text-xs tracking-[0.25em] uppercase font-semibold rounded-full px-6 py-3 border border-white/40 bg-white/5 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-white/10 cursor-pointer"
            style={{ color: "#fff" }}
          >
            Get guide
          </button>
        </div>
      </div>
    </section>
  );
};
export default HeroSection;
