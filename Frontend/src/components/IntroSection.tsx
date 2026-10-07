import { useApplyNav } from "@/lib/applyNav";

import coworking from "@/assets/gallery-4.jpg";
import pool from "@/assets/gallery-1.jpg";
import community from "@/assets/life/community-dinner.webp";
import gym from "@/assets/gallery-3.jpg";
import talks from "@/assets/gallery-9.webp";

/**
 * A fan of photos, outermost first. Each card: how far from the centre, how
 * much it tilts, and how big — the middle one largest and on top.
 */
const FAN = [
  { src: coworking, alt: "Coworking", x: -2, rotate: -14, scale: 0.8 },
  { src: pool, alt: "Pool at Duna Tower", x: -1, rotate: -7, scale: 0.9 },
  { src: community, alt: "Community dinner", x: 0, rotate: 0, scale: 1 },
  { src: talks, alt: "Founder talk", x: 1, rotate: 7, scale: 0.9 },
  { src: gym, alt: "Gym", x: 2, rotate: 14, scale: 0.8 },
];

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
      // overflow-hidden: on a phone the outer cards of the fan reach past the screen edge.
      className="py-24 md:py-36 px-8 md:px-12 flex flex-col items-center text-center overflow-hidden"
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

      {/* The fan. Cards sit on one centre point and are pushed out sideways
          and tilted, so it scales with the card width alone. */}
      <div data-intro-fan className="relative mt-16 md:mt-20 w-full h-[260px] sm:h-[380px] md:h-[460px]">
        {FAN.map((card) => (
          <div
            key={card.alt}
            className="absolute left-1/2 top-1/2 w-[150px] sm:w-[210px] md:w-[260px] aspect-[3/4] rounded-2xl overflow-hidden shadow-xl transition-transform duration-500"
            style={{
              transform: `translate(-50%, -50%) translateX(${card.x * 62}%) rotate(${card.rotate}deg) scale(${card.scale})`,
              zIndex: 10 - Math.abs(card.x),
              border: "6px solid hsl(30 30% 98%)",
              backgroundColor: "hsl(30 30% 98%)",
            }}
          >
            <img src={card.src} alt={card.alt} loading="lazy" decoding="async" className="w-full h-full object-cover rounded-xl" />
          </div>
        ))}
      </div>
    </section>
  );
};

export default IntroSection;
