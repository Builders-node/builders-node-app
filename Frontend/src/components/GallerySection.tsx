import { useEffect, useRef } from "react";
import { useGsapTitle } from "@/hooks/useGsapTitle";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import gallery1 from "@/assets/gallery-1.jpg";
import { useApplyNav } from "@/lib/applyNav";

import gallery3 from "@/assets/gallery-3.jpg";
import gallery4 from "@/assets/gallery-4.jpg";
import gallery5 from "@/assets/gallery-5.jpg";

import gallery7 from "@/assets/gallery-7.jpg";
import gallery8 from "@/assets/gallery-8.jpg";
import gallery9 from "@/assets/gallery-9.jpg";
import gallery10 from "@/assets/gallery-10.jpg";

gsap.registerPlugin(ScrollTrigger);

const textDark = "hsl(0 0% 10%)";
const textMuted = "hsl(0 0% 45%)";

interface GalleryItem {
  src: string;
  label: string;
  w: string;
  h: string;
  rotate: string;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  centerX?: boolean;
}

const items: GalleryItem[] = [
  // Top row — corners pulled inward for oval shape
  { src: gallery1, label: "Duna Pool", top: "4%", left: "13%", w: "290px", h: "220px", rotate: "-3deg" },
  { src: gallery3, label: "Duna Gym", top: "1%", left: "calc(50% - 130px)", w: "260px", h: "200px", rotate: "1.5deg" },
  { src: gallery5, label: "Workshops", top: "4%", right: "13%", w: "275px", h: "210px", rotate: "2.5deg" },
  // Middle row — widest point of the oval
  { src: gallery10, label: "Coastline", top: "34%", left: "2%", w: "285px", h: "240px", rotate: "-2deg" },
  { src: gallery4, label: "Coworking", top: "32%", right: "2%", w: "280px", h: "245px", rotate: "2deg" },
  // Bottom row — corners pulled inward for oval shape
  { src: gallery8, label: "Activities", bottom: "4%", left: "13%", w: "285px", h: "215px", rotate: "2deg" },
  { src: gallery9, label: "Community", bottom: "1%", left: "calc(50% - 127px)", w: "255px", h: "210px", rotate: "-2deg" },
  { src: gallery7, label: "Wellness", bottom: "4%", right: "13%", w: "280px", h: "215px", rotate: "-1.5deg" },
];

const GallerySection = () => {
  const titleRef = useGsapTitle<HTMLHeadingElement>();
  const sectionRef = useRef<HTMLElement>(null);
  const desktopRef = useRef<HTMLDivElement>(null);
  const mobileGridRef = useRef<HTMLDivElement>(null);
  const openApply = useApplyNav();

  // Desktop: photos fly in from edges with stagger
  useEffect(() => {
    if (!desktopRef.current) return;

    const cards = desktopRef.current.querySelectorAll(".gallery-card");
    const centerText = desktopRef.current.querySelector(".gallery-center");

    const ctx = gsap.context(() => {
      // Cards fly in from their respective edges
      cards.forEach((card, i) => {
        const el = card as HTMLElement;
        const hasLeft = el.style.left;
        const hasRight = el.style.right;
        const hasTop = el.style.top;
        const hasBottom = el.style.bottom;
        const isCentered = el.dataset.centerx === "true";

        let xFrom = 0;
        let yFrom = 0;

        if (hasLeft && parseFloat(hasLeft) < 50) xFrom = -120;
        else if (hasRight) xFrom = 120;

        if (hasTop && parseFloat(hasTop) < 20) yFrom = -80;
        else if (hasBottom) yFrom = 80;

        gsap.fromTo(card,
          { opacity: 0, x: xFrom, y: yFrom, scale: 0.8 },
          {
            opacity: 1,
            x: 0,
            y: 0,
            scale: 1,
            duration: 0.9,
            delay: i * 0.08,
            ease: "power3.out",
            clearProps: isCentered ? "transform" : "",
            scrollTrigger: {
              trigger: desktopRef.current,
              start: "top 75%",
              toggleActions: "play none none none",
              onEnter: () => {
                if (isCentered) {
                  gsap.set(card, { clearProps: "transform" });
                  (card as HTMLElement).style.transform = `translateX(-50%) rotate(${(card as HTMLElement).dataset.rotate || '0deg'})`;
                }
              }
            },
          }
        );
      });

      // Center text fades in after cards
      if (centerText) {
        gsap.fromTo(centerText,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power2.out",
            scrollTrigger: {
              trigger: desktopRef.current,
              start: "top 60%",
              toggleActions: "play none none none",
            },
          }
        );
      }
    }, desktopRef);

    return () => ctx.revert();
  }, []);

  // Mobile: grid items stagger in
  useEffect(() => {
    if (!mobileGridRef.current) return;

    const gridItems = mobileGridRef.current.querySelectorAll(".gallery-mobile-item");

    const ctx = gsap.context(() => {
      gsap.fromTo(gridItems,
        { opacity: 0, y: 40, scale: 0.9 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.6,
          stagger: 0.07,
          ease: "power2.out",
          scrollTrigger: {
            trigger: mobileGridRef.current,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        }
      );
    }, mobileGridRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative overflow-hidden" style={{ backgroundColor: "hsl(30 30% 93%)" }}>
      {/* Mobile: grid layout */}
      <div className="md:hidden py-12 px-4">
        <div className="text-center mb-8">
          <h2
            ref={titleRef}
            className="text-3xl font-light tracking-tight leading-tight"
            style={{ color: textDark }}
          >
            Life at
            <br />
            Builders Node
          </h2>
          <p
            className="mt-3 text-sm tracking-wide max-w-md mx-auto"
            style={{ color: textMuted }}
          >
            A vibrant community where learning, work,
            <br />
            and adventure come together.
          </p>
          <button
            onClick={openApply}
            className="mt-6 px-6 py-2.5 text-sm font-medium tracking-wide rounded-full transition-all duration-300 hover:scale-105 pointer-events-auto"
            style={{ backgroundColor: "hsl(20 100% 55%)", color: "hsl(0 0% 100%)" }}
          >
            Apply
          </button>
        </div>
        <div ref={mobileGridRef} className="grid grid-cols-2 gap-3">
          {items.map((item) => (
            <div key={item.label} className="group gallery-mobile-item">
              <div className="rounded-xl overflow-hidden shadow-md">
                <img
                  src={item.src}
                  alt={item.label}
                  loading="lazy"
                  className="w-full h-32 object-cover"
                />
              </div>
              <p
                className="mt-1.5 text-[9px] tracking-[0.15em] uppercase text-center"
                style={{ color: textMuted }}
              >
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: scattered floating layout */}
      <div ref={desktopRef} className="hidden md:block relative" style={{ height: "900px" }}>
        {items.map((item) => (
          <div
            key={item.label}
            className="absolute group gallery-card"
            data-centerx={item.centerX ? "true" : "false"}
            data-rotate={item.rotate}
            style={{
              top: item.top,
              left: item.left,
              right: item.right,
              bottom: item.bottom,
              width: item.w,
              transform: `${item.centerX ? 'translateX(-50%) ' : ''}rotate(${item.rotate})`,
              opacity: 0,
            }}
          >
            <div className="rounded-2xl overflow-hidden shadow-lg transition-transform duration-500 group-hover:scale-105 group-hover:shadow-2xl">
              <img
                src={item.src}
                alt={item.label}
                loading="lazy"
                className="w-full object-cover"
                style={{ height: item.h }}
              />
            </div>
            <p
              className="mt-2 text-[10px] tracking-[0.15em] uppercase text-center"
              style={{ color: textMuted }}
            >
              {item.label}
            </p>
          </div>
        ))}

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 gallery-center" style={{ opacity: 0 }}>
          <h2
            className="text-5xl lg:text-6xl font-light tracking-tight text-center max-w-lg leading-tight"
            style={{ color: textDark }}
          >
            Life at
            <br />
            Builders Node
          </h2>
          <p
            className="mt-4 text-sm tracking-wide text-center max-w-md"
            style={{ color: textMuted }}
          >
            A vibrant community where learning, work,
            <br />
            and adventure come together.
          </p>
          <button
            onClick={openApply}
            className="mt-6 px-6 py-2.5 text-sm font-medium tracking-wide rounded-full transition-all duration-300 hover:scale-105 pointer-events-auto"
            style={{ backgroundColor: "hsl(20 100% 55%)", color: "hsl(0 0% 100%)" }}
          >
            Apply
          </button>
        </div>
      </div>
    </section>
  );
};

export default GallerySection;
