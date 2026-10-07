import { useGsapTitle } from "@/hooks/useGsapTitle";
import { useApplyNav } from "@/lib/applyNav";

import pool from "@/assets/gallery-1.jpg";
import community from "@/assets/gallery-2.jpg";
import gym from "@/assets/gallery-3.jpg";
import coworking from "@/assets/gallery-4.jpg";
import workshops from "@/assets/gallery-5.webp";

/** The labels these photos already carried on the landing. */
const PHOTOS = [
  { src: pool, label: "Duna Pool" },
  { src: community, label: "Community" },
  { src: gym, label: "Duna Gym" },
  { src: coworking, label: "Coworking" },
  { src: workshops, label: "Workshops" },
];

const textDark = "hsl(0 0% 10%)";
const textMuted = "hsl(0 0% 45%)";

/**
 * The main landing's "What Builders Node is": a large centred title, a row
 * of photos under small uppercase labels, and the one-line description set
 * large and centred beneath — an editorial layout, in the landing's own type.
 */
const IntroSection = () => {
  const titleRef = useGsapTitle<HTMLHeadingElement>();
  const openApply = useApplyNav();

  return (
    <section id="about" className="py-24 md:py-32" style={{ backgroundColor: "hsl(30 30% 93%)" }}>
      <h2
        ref={titleRef}
        className="px-8 md:px-12 text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light tracking-tight leading-[1.02] text-center"
        style={{ color: textDark }}
      >
        What Builders Node is
      </h2>

      <div className="mt-16 md:mt-24">
        <div className="px-8 md:px-12 flex items-baseline justify-between mb-3">
          <p className="text-[11px] tracking-[0.2em] uppercase" style={{ color: textMuted }}>
            Our community
          </p>
          <button
            type="button"
            onClick={openApply}
            className="text-[11px] tracking-[0.2em] uppercase bg-transparent border-0 p-0 cursor-pointer transition-opacity hover:opacity-60"
            style={{ color: textDark }}
          >
            Apply →
          </button>
        </div>

        {/* Five across on a wide screen; a row to swipe through on a phone. */}
        <div
          className="flex md:grid md:grid-cols-5 gap-3 overflow-x-auto md:overflow-visible px-8 md:px-12 snap-x snap-mandatory scroll-pl-8"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {PHOTOS.map((photo) => (
            <figure key={photo.label} className="m-0 flex-shrink-0 w-[62vw] sm:w-[40vw] md:w-auto snap-start">
              <div className="rounded-2xl overflow-hidden aspect-[4/5]">
                <img src={photo.src} alt={photo.label} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </div>
              <figcaption className="mt-2 text-sm md:text-base font-light" style={{ color: textDark }}>
                {photo.label}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      <p
        className="mt-20 md:mt-28 px-8 md:px-12 mx-auto max-w-5xl text-2xl sm:text-3xl md:text-4xl lg:text-[2.75rem] font-normal tracking-tight leading-[1.2] text-center"
        style={{ color: textDark }}
      >
        A coliving community where founders, builders and creators live in the same tower for 1-3 months, work on their
        own projects, and share dinners, sport and weekends.
      </p>
    </section>
  );
};

export default IntroSection;
