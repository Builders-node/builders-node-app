import { useState, useRef, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import gsap from "gsap";

import reviewSarah from "@/assets/review-sarah.jpg";
import reviewCarlos from "@/assets/review-carlos.jpg";
import reviewElena from "@/assets/review-elena.jpg";
import reviewJames from "@/assets/review-james.jpg";
import reviewMaria from "@/assets/review-maria.jpg";
import reviewDavid from "@/assets/review-david.jpg";

const reviews = [
  {
    name: "Sarah Mitchell",
    role: "Entrepreneur",
    since: "since 2021",
    quote: "Próspera gave me the freedom to build my business without the red tape. The community here is incredible — everyone is driven, supportive, and genuinely invested in each other's success.",
    image: reviewSarah,
  },
  {
    name: "Carlos Rivera",
    role: "Software Developer",
    since: "since 2022",
    quote: "Moving to Próspera was the best decision I ever made. The digital infrastructure is world-class, and the governance model actually makes sense for modern entrepreneurs.",
    image: reviewCarlos,
  },
  {
    name: "Elena Vasquez",
    role: "Investment Advisor",
    since: "since 2020",
    quote: "The legal framework here is transparent and efficient. I've helped dozens of clients establish operations in Próspera, and the process is remarkably streamlined.",
    image: reviewElena,
  },
  {
    name: "James Chen",
    role: "Architect",
    since: "since 2023",
    quote: "Designing in Próspera is a dream. The blend of modern infrastructure with natural beauty creates an environment where creativity thrives naturally.",
    image: reviewJames,
  },
  {
    name: "Maria Santos",
    role: "Community Manager",
    since: "since 2021",
    quote: "What makes Próspera special is the people. Every day I witness collaboration, innovation, and a shared commitment to building something truly meaningful.",
    image: reviewMaria,
  },
  {
    name: "David Kim",
    role: "Blockchain Engineer",
    since: "since 2022",
    quote: "The regulatory environment here actually encourages innovation instead of stifling it. Próspera understands that the future of governance is digital.",
    image: reviewDavid,
  },
];

const ReviewsSection = () => {
  const [active, setActive] = useState(0);
  const isAnimating = useRef(false);
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);
  const quoteRef = useRef<HTMLParagraphElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = reviews[active];

  const animateTo = useCallback((newIndex: number) => {
    if (isAnimating.current || newIndex === active) return;
    isAnimating.current = true;

    const oldImg = imgRefs.current[active];
    const newImg = imgRefs.current[newIndex];

    const tl = gsap.timeline({
      onComplete: () => {
        isAnimating.current = false;
        // Reset old image
        if (oldImg) gsap.set(oldImg, { opacity: 0, scale: 1 });
      },
    });

    // 1. Fade out text
    tl.to([quoteRef.current, nameRef.current], {
      opacity: 0,
      y: -20,
      duration: 0.35,
      ease: "power2.in",
      stagger: 0.04,
    });

    // 2. Crossfade images
    tl.to(oldImg, {
      opacity: 0,
      scale: 1.04,
      duration: 0.55,
      ease: "power2.inOut",
    }, "-=0.15");

    tl.fromTo(newImg,
      { opacity: 0, scale: 1.08 },
      { opacity: 1, scale: 1, duration: 0.55, ease: "power2.inOut" },
      "<"
    );

    // 3. Update state and fade in text
    tl.add(() => setActive(newIndex));

    tl.fromTo([quoteRef.current, nameRef.current],
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.45, ease: "power2.out", stagger: 0.06 },
      "-=0.1"
    );
  }, [active]);

  const prev = () => animateTo(active === 0 ? reviews.length - 1 : active - 1);
  const next = () => animateTo(active === reviews.length - 1 ? 0 : active + 1);

  // Preload all images
  useEffect(() => {
    reviews.forEach((r) => {
      const img = new Image();
      img.src = r.image;
    });
  }, []);

  return (
    <section>
      <div ref={containerRef}>
        <div className="relative overflow-hidden" style={{ height: "850px" }}>
          {/* All background images stacked — only active one visible */}
          {reviews.map((r, i) => (
            <img
              key={r.name}
              ref={(el) => { imgRefs.current[i] = el; }}
              src={r.image}
              alt={r.name}
              width={800}
              height={1024}
              className="absolute inset-0 w-full h-full object-cover object-top will-change-transform"
              style={{ opacity: i === 0 ? 1 : 0 }}
            />
          ))}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />

          {/* Content overlay */}
          <div className="absolute inset-0 flex flex-col justify-between p-8 md:p-12 lg:p-16">
            {/* Top row */}
            <div className="flex flex-col lg:flex-row justify-between gap-8">
              <h3
                ref={titleRef}
                className="text-2xl md:text-3xl lg:text-4xl font-light leading-snug max-w-sm text-white"
                style={{ textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}
              >
                Próspera — it's the people you work with every day
              </h3>
              <div className="flex items-start gap-4">
                <p
                  ref={quoteRef}
                  className="text-sm md:text-base font-light leading-relaxed max-w-sm text-white/90 will-change-transform"
                  style={{ textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}
                >
                  {current.quote}
                </p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={prev}
                    disabled={isAnimating.current}
                    className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center transition-all duration-300 hover:bg-white/20 hover:border-white/60 text-white disabled:opacity-50 bg-black/20"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={next}
                    disabled={isAnimating.current}
                    className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center transition-all duration-300 hover:bg-white/20 hover:border-white/60 text-white disabled:opacity-50 bg-black/20"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
              <div className="flex items-center gap-2 md:gap-3">
                {reviews.map((r, i) => (
                  <button
                    key={r.name}
                    onClick={() => animateTo(i)}
                    className="rounded-full overflow-hidden transition-all duration-500 border-2 flex-shrink-0 hover:scale-110"
                    style={{
                      width: i === active ? "56px" : "44px",
                      height: i === active ? "56px" : "44px",
                      borderColor: i === active ? "white" : "rgba(255,255,255,0.2)",
                      boxShadow: i === active ? "0 0 20px rgba(255,255,255,0.3)" : "none",
                    }}
                  >
                    <img
                      src={r.image}
                      alt={r.name}
                      className="w-full h-full object-cover"
                      width={56}
                      height={56}
                    />
                  </button>
                ))}
              </div>

              <div
                ref={nameRef}
                className="flex items-baseline gap-6 md:gap-10 flex-shrink-0 will-change-transform"
              >
                <span
                  className="text-sm md:text-base font-light text-white"
                  style={{ textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}
                >
                  {current.name}
                </span>
                <span className="text-xs md:text-sm tracking-wide text-white/70">
                  {current.role}
                </span>
                <span className="text-xs tracking-[0.15em] text-white/70">
                  {current.since}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ReviewsSection;
