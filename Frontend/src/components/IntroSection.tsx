import { useApplyNav } from "@/lib/applyNav";

const textDark = "hsl(0 0% 10%)";
const textMuted = "hsl(0 0% 45%)";
const accent = "#EA5404";

/**
 * The main landing's "What Builders Node is", set as a statement: the name
 * small and in brackets, the description large and centred, one button under
 * it — in the landing's own type and accent.
 */
const IntroSection = () => {
  const openApply = useApplyNav();

  return (
    <section
      id="about"
      className="py-24 md:py-36 px-8 md:px-12 flex flex-col items-center text-center"
      style={{ backgroundColor: "hsl(30 30% 93%)" }}
    >
      <p className="text-sm md:text-base" style={{ color: textMuted }}>
        ( What Builders Node is )
      </p>

      <p
        className="mt-8 md:mt-10 max-w-4xl text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight leading-[1.15]"
        style={{ color: textDark }}
      >
        A coliving community where founders, builders and creators live in the same tower for 1-3 months, work on their
        own projects, and share dinners, sport and weekends.
      </p>

      <button
        type="button"
        onClick={openApply}
        className="mt-10 md:mt-12 inline-flex items-center gap-3 rounded-full pl-6 pr-7 py-3.5 text-xs tracking-[0.25em] uppercase font-semibold border-none cursor-pointer transition-transform duration-300 hover:scale-105"
        style={{ backgroundColor: textDark, color: "#fff" }}
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} aria-hidden="true" />
        Apply
      </button>
    </section>
  );
};

export default IntroSection;
