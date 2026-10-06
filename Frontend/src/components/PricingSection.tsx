import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useApplyNav } from "@/lib/applyNav";
import { useGsapTitle } from "@/hooks/useGsapTitle";
import { useModalA11y } from "@/lib/useModalA11y";

import apartment from "@/assets/pricing/apartment.webp";
import seaViewRoom from "@/assets/adv-room.jpg";
import coworking from "@/assets/pricing/coworking.jpg";
import pool from "@/assets/pricing/pool.avif";

type Photo = { src: string; alt: string };

type Plan = {
  name: string;
  price: string;
  features: string[];
  photos: Photo[];
  popular?: boolean;
};

/**
 * The two plans, as the landing quotes them.
 *
 * Written here rather than read from the plan catalogue: the catalogue is what
 * the apply form and the payment step price from, and it still has to be set
 * up to match these (Admin → Membership plans).
 */
const PLANS: Plan[] = [
  {
    name: "Coliving",
    price: "$999",
    features: [
      "Your own private apartment in Duna Tower",
      "Pool, coworking and gym in the building",
      "A community of like-minded founders and builders",
      "Workshops",
      "E-Residency",
      "Founder sessions",
      "Stays of 1+ month",
    ],
    photos: [
      { src: apartment, alt: "Apartment in Duna Tower — living room and bedroom" },
      { src: seaViewRoom, alt: "Bedroom with a sea view" },
      { src: coworking, alt: "Coworking in the building" },
      { src: pool, alt: "Pool" },
    ],
  },
];

// The landing's own palette and type — light headings, muted body, uppercase
// tracked labels and buttons — rather than the mock-up's heavier weights.
const textDark = "hsl(0 0% 10%)";
const textMuted = "hsl(0 0% 45%)";
const borderLight = "hsl(0 0% 10% / 0.12)";
const accent = "#EA5404";

const PricingSection = () => {
  const openApply = useApplyNav();
  const [gallery, setGallery] = useState<{ plan: Plan; index: number } | null>(null);
  const titleRef = useGsapTitle<HTMLHeadingElement>();

  return (
    <section id="pricing" className="py-24 md:py-32 px-8 md:px-12" style={{ backgroundColor: "hsl(30 30% 93%)" }}>
      <div className="mb-12 md:mb-16">
        <h2 ref={titleRef} className="text-4xl md:text-6xl font-light tracking-tight" style={{ color: textDark }}>
          Two plans. That&apos;s it.
        </h2>
      </div>

      {/* One plan, across the full width. */}
      <div className="grid grid-cols-1 gap-6">
        {PLANS.map((plan) => (
          <article
            key={plan.name}
            // Plan on the left, photos on the right on a wide screen; on a
            // phone the photos come first, above the plan.
            className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-6 rounded-2xl p-3 border"
            style={{
              backgroundColor: "hsl(0 0% 100% / 0.35)",
              borderColor: plan.popular ? accent : borderLight,
            }}
          >
            <div className="lg:order-2 lg:h-full">
              <PhotoSlider plan={plan} onOpen={(index) => setGallery({ plan, index })} />
            </div>

            <div className="flex flex-col flex-1 px-4 sm:px-5 pt-7 pb-4 lg:order-1 lg:py-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-xs tracking-[0.25em] uppercase font-normal" style={{ color: textMuted }}>
                  {plan.name}
                </h3>
                {plan.popular ? (
                  <span className="rounded-full px-3 py-1.5 text-[10px] tracking-[0.2em] uppercase font-semibold text-white" style={{ backgroundColor: accent }}>
                    Most popular
                  </span>
                ) : null}
              </div>

              <p className="flex items-baseline gap-1 mb-6" style={{ color: textDark }}>
                <span className="text-5xl md:text-6xl font-light tracking-tight">{plan.price}</span>
                <span className="text-base font-light" style={{ color: textMuted }}>/month</span>
              </p>

              <ul className="space-y-3 mb-8 flex-1 list-none p-0">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-base md:text-lg font-light" style={{ color: textMuted }}>
                    <span className="mt-2.5 inline-block w-1.5 h-1.5 rounded-full flex-none" style={{ backgroundColor: accent }} aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={openApply}
                className="w-full rounded-full py-3.5 text-xs tracking-[0.25em] uppercase font-semibold text-white border-0 cursor-pointer transition-all duration-300 hover:scale-[1.02]"
                style={{
                  backgroundColor: plan.popular ? accent : textDark,
                  boxShadow: plan.popular ? "0 10px 28px rgba(234, 84, 4, 0.35)" : undefined,
                }}
              >
                Apply
              </button>
            </div>
          </article>
        ))}
      </div>

      {gallery ? (
        <PhotoViewer
          photos={gallery.plan.photos}
          title={gallery.plan.name}
          start={gallery.index}
          onClose={() => setGallery(null)}
        />
      ) : null}
    </section>
  );
};

/**
 * The card's photos as a slider: swipe or the arrows, one photo per stop with
 * the next one peeking in, and a counter. Tapping a photo opens it full size.
 */
function PhotoSlider({ plan, onOpen }: { plan: Plan; onOpen: (index: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = plan.photos.length;

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    // Which slide is in front, from where the track has scrolled to — so the
    // counter follows a swipe as well as the arrows.
    const onScroll = () => {
      const slide = track.firstElementChild as HTMLElement | null;
      if (!slide) return;
      // Scrolled all the way: the last photo is in view even when it can't
      // reach the left edge (two to a row on a wide card).
      const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
      const step = slide.offsetWidth + 8;
      setIndex(atEnd ? count - 1 : Math.min(count - 1, Math.round(track.scrollLeft / step)));
    };
    onScroll();
    track.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      track.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [count]);

  const goTo = (next: number) => {
    const track = trackRef.current;
    const slide = track?.children[next] as HTMLElement | undefined;
    if (track && slide) track.scrollTo({ left: slide.offsetLeft - track.offsetLeft, behavior: "smooth" });
  };

  const arrow =
    "absolute top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center border-0 cursor-pointer text-white transition-opacity disabled:opacity-0";

  return (
    <div className="relative h-56 sm:h-72 lg:h-full lg:min-h-[420px]">
      <div
        ref={trackRef}
        className="flex gap-2 h-full overflow-x-auto snap-x snap-mandatory rounded-xl"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {plan.photos.map((photo, i) => (
          <button
            key={photo.src}
            type="button"
            onClick={() => onOpen(i)}
            className="relative flex-[0_0_88%] h-full overflow-hidden rounded-xl p-0 border-0 cursor-pointer snap-start"
            aria-label={`${plan.name} photo ${i + 1} of ${count} — open full size`}
          >
            <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      <button
        type="button"
        aria-label="Previous photo"
        onClick={() => goTo(Math.max(0, index - 1))}
        disabled={index === 0}
        className={`${arrow} left-2`}
        style={{ backgroundColor: "hsl(0 0% 10% / 0.6)" }}
      >
        <ArrowLeft size={16} />
      </button>
      <button
        type="button"
        aria-label="Next photo"
        onClick={() => goTo(Math.min(count - 1, index + 1))}
        disabled={index === count - 1}
        className={`${arrow} right-2`}
        style={{ backgroundColor: "hsl(0 0% 10% / 0.6)" }}
      >
        <ArrowRight size={16} />
      </button>
      <span
        className="absolute bottom-3 right-3 rounded-full px-3 py-1.5 text-[10px] tracking-[0.15em] uppercase font-semibold text-white pointer-events-none"
        style={{ backgroundColor: "hsl(0 0% 10% / 0.75)" }}
        aria-hidden="true"
      >
        {index + 1} / {count}
      </span>
    </div>
  );
}

/** A plain lightbox: one photo at a time, arrows and keys to move, Esc to close. */
function PhotoViewer({ photos, title, start, onClose }: { photos: Photo[]; title: string; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const ref = useModalA11y<HTMLDivElement>(onClose);
  const go = (step: number) => setIndex((current) => (current + step + photos.length) % photos.length);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const photo = photos[index];
  const arrow = "absolute top-1/2 -translate-y-1/2 rounded-full p-3 border-0 cursor-pointer text-white";

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} photos`}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-10"
      style={{ backgroundColor: "hsl(0 0% 0% / 0.88)" }}
      onClick={onClose}
    >
      <img
        src={photo.src}
        alt={photo.alt}
        className="max-w-full max-h-full object-contain rounded-xl"
        onClick={(event) => event.stopPropagation()}
      />
      <button type="button" aria-label="Close" onClick={onClose} className="absolute top-4 right-4 rounded-full p-2 border-0 cursor-pointer text-white" style={{ backgroundColor: "hsl(0 0% 100% / 0.15)" }}>
        <X size={22} />
      </button>
      {photos.length > 1 ? (
        <>
          <button type="button" aria-label="Previous photo" onClick={(event) => { event.stopPropagation(); go(-1); }} className={`${arrow} left-3 sm:left-6`} style={{ backgroundColor: "hsl(0 0% 100% / 0.15)" }}>
            <ArrowLeft size={22} />
          </button>
          <button type="button" aria-label="Next photo" onClick={(event) => { event.stopPropagation(); go(1); }} className={`${arrow} right-3 sm:right-6`} style={{ backgroundColor: "hsl(0 0% 100% / 0.15)" }}>
            <ArrowRight size={22} />
          </button>
          <span className="absolute bottom-5 left-1/2 -translate-x-1/2 text-sm text-white/80">
            {index + 1} / {photos.length}
          </span>
        </>
      ) : null}
    </div>
  );
}

export default PricingSection;
