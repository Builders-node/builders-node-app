import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useGsapTitle } from "@/hooks/useGsapTitle";

import mon from "@/assets/week/mon.webp";
import tue from "@/assets/week/tue.webp";
import wed from "@/assets/week/wed.webp";
import thu from "@/assets/week/thu.webp";
import fri from "@/assets/week/fri.webp";
import sat from "@/assets/week/sat.webp";

/** One moment per day. Photos are our own, picked to match each line. */
const DAYS = [
  { day: "Mon", moment: "Kickoff dinner", image: mon },
  { day: "Tue", moment: "7am pickleball", image: tue },
  { day: "Wed", moment: "Founder talk", image: wed },
  { day: "Thu", moment: "Demo night", image: thu },
  { day: "Fri", moment: "Sunset at the pool", image: fri },
  { day: "Sat", moment: "Dive trip", image: sat },
];

const textDark = "hsl(0 0% 10%)";
const borderLight = "hsl(0 0% 10% / 0.12)";

/**
 * A week at Builders Node — a row of days to scroll through, in the same
 * shape as the landing's other sliders (MissionSection): light heading,
 * round arrow buttons, rounded-2xl cards, hidden scrollbar.
 */
const WeekSection = () => {
  const titleRef = useGsapTitle<HTMLHeadingElement>();
  const sliderRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    const check = () => {
      setCanLeft(el.scrollLeft > 10);
      setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  const scroll = (dir: -1 | 1) => {
    const el = sliderRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  };

  const arrow = (enabled: boolean) => ({
    borderColor: borderLight,
    color: enabled ? textDark : "hsl(0 0% 80%)",
    opacity: enabled ? 1 : 0.4,
  });

  return (
    <section id="week" className="py-24 md:py-32">
      <div className="px-8 md:px-12 flex items-end justify-between gap-6 mb-10">
        <h2 ref={titleRef} className="text-4xl md:text-6xl font-light tracking-tight" style={{ color: textDark }}>
          A week at Builders Node
        </h2>
        <div className="hidden sm:flex items-center gap-3 flex-none">
          <button
            type="button"
            aria-label="Previous days"
            onClick={() => scroll(-1)}
            className="w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-300 hover:bg-[hsl(0_0%_10%)] hover:text-white"
            style={arrow(canLeft)}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="Next days"
            onClick={() => scroll(1)}
            className="w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-300 hover:bg-[hsl(0_0%_10%)] hover:text-white"
            style={arrow(canRight)}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={sliderRef}
        className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scroll-pl-8 md:scroll-pl-12"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div className="flex-shrink-0 w-3 md:w-7" />
        {DAYS.map((item) => (
          <article key={item.day} className="flex-shrink-0 snap-start" style={{ width: "min(300px, 70vw)" }}>
            <div className="rounded-2xl overflow-hidden aspect-[3/4]">
              <img src={item.image} alt={item.moment} loading="lazy" decoding="async" className="w-full h-full object-cover" />
            </div>
            <p className="mt-5 text-[11px] tracking-[0.2em] uppercase" style={{ color: "hsl(16 90% 45%)" }}>
              {item.day}
            </p>
            <p className="mt-2 text-xl md:text-2xl font-light" style={{ color: textDark }}>
              {item.moment}
            </p>
          </article>
        ))}
        <div className="flex-shrink-0 w-3 md:w-7" />
      </div>
    </section>
  );
};

export default WeekSection;
