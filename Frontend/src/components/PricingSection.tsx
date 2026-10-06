import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useApplyNav } from "@/lib/applyNav";
import { useModalA11y } from "@/lib/useModalA11y";

import apartment from "@/assets/pricing/apartment.webp";
import seaViewRoom from "@/assets/adv-room.jpg";
import coworking from "@/assets/pricing/coworking.jpg";
import pool from "@/assets/pricing/pool.avif";
import meal1 from "@/assets/pricing/meal-1.jpg";
import meal2 from "@/assets/pricing/meal-2.jpg";
import meal3 from "@/assets/pricing/meal-3.jpg";

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
      "Stays of 1+ month",
    ],
    photos: [
      { src: apartment, alt: "Apartment in Duna Tower — living room and bedroom" },
      { src: seaViewRoom, alt: "Bedroom with a sea view" },
      { src: coworking, alt: "Coworking in the building" },
      { src: pool, alt: "Pool" },
    ],
  },
  {
    name: "Coliving + Meals",
    price: "$1,500",
    popular: true,
    features: ["Everything in Coliving", "Three chef-cooked meals a day, Monday to Saturday"],
    photos: [
      { src: meal1, alt: "A chef-cooked meal" },
      { src: meal2, alt: "A chef-cooked meal" },
      { src: meal3, alt: "A chef-cooked meal" },
    ],
  },
];

const textDark = "hsl(0 0% 10%)";
const accent = "#EA5404";

const PricingSection = () => {
  const openApply = useApplyNav();
  const [gallery, setGallery] = useState<{ plan: Plan; index: number } | null>(null);

  return (
    <section id="pricing" className="py-20 md:py-28 px-8 md:px-12" style={{ backgroundColor: "hsl(30 30% 93%)" }}>
      <h2
        className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tighter leading-[1.05] mb-10 md:mb-12"
        style={{ color: textDark }}
      >
        Two plans. That&apos;s it.
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {PLANS.map((plan) => (
          <article
            key={plan.name}
            className="flex flex-col rounded-3xl p-3 border"
            style={{
              backgroundColor: "hsl(40 33% 98%)",
              borderColor: plan.popular ? accent : "hsl(0 0% 10% / 0.1)",
            }}
          >
            {/* The first photo large, the next one peeking beside it — a
                hint that there are more, which the button opens. */}
            <div className="relative grid grid-cols-[1fr_72px] sm:grid-cols-[1fr_88px] gap-2 h-56 sm:h-72">
              <button
                type="button"
                onClick={() => setGallery({ plan, index: 0 })}
                className="relative overflow-hidden rounded-2xl p-0 border-0 cursor-pointer"
                aria-label={`See ${plan.name} photos`}
              >
                <img src={plan.photos[0].src} alt={plan.photos[0].alt} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </button>
              <button
                type="button"
                onClick={() => setGallery({ plan, index: 1 })}
                className="relative overflow-hidden rounded-2xl p-0 border-0 cursor-pointer"
                aria-label={`See all ${plan.photos.length} ${plan.name} photos`}
              >
                <img src={plan.photos[1].src} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </button>
              {/* On the block, not inside the narrow photo: there it was cut
                  off on a phone. Decorative — both photos already open it. */}
              <span
                className="absolute bottom-3 right-2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold text-white pointer-events-none"
                style={{ backgroundColor: "hsl(0 0% 10% / 0.75)" }}
                aria-hidden="true"
              >
                {plan.photos.length} photos →
              </span>
            </div>

            <div className="flex flex-col flex-1 px-4 sm:px-5 pt-7 pb-4">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-sm sm:text-base font-semibold tracking-wide uppercase" style={{ color: textDark }}>
                  {plan.name}
                </h3>
                {plan.popular ? (
                  <span className="rounded-full px-3 py-1.5 text-xs sm:text-sm font-semibold text-white" style={{ backgroundColor: accent }}>
                    Most popular
                  </span>
                ) : null}
              </div>

              <p className="flex items-baseline gap-1 mb-6" style={{ color: textDark }}>
                <span className="text-6xl sm:text-7xl font-bold tracking-tighter">{plan.price}</span>
                <span className="text-lg" style={{ color: "hsl(0 0% 40%)" }}>/month</span>
              </p>

              <ul className="space-y-3 mb-8 flex-1 list-none p-0">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-base sm:text-lg" style={{ color: textDark }}>
                    <span className="mt-2 inline-block w-2 h-2 rounded-sm flex-none" style={{ backgroundColor: accent }} aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={openApply}
                className="w-full rounded-full py-4 text-lg font-semibold text-white border-0 cursor-pointer transition-transform hover:scale-[1.01]"
                style={{ backgroundColor: plan.popular ? accent : textDark }}
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
