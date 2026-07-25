import { FileText, Percent, Scale, Shield, Monitor, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { useGsapTitle } from "@/hooks/useGsapTitle";
import communityImg1 from "@/assets/gallery-4.jpg";
import communityImg2 from "@/assets/gallery-5.jpg";
import govClarity from "@/assets/governance-clarity.jpg";
import govEfficiency from "@/assets/governance-efficiency.jpg";
import govSupport from "@/assets/governance-support.jpg";
import govSecurity from "@/assets/governance-security.jpg";
import govAccess from "@/assets/governance-access.jpg";

const textDark = "hsl(0 0% 10%)";
const textMuted = "hsl(0 0% 45%)";
const borderLight = "hsl(0 0% 10% / 0.12)";

const governanceItems = [
  { icon: FileText, title: "Start your business faster", desc: "Register and launch your business in as little as 40 minutes using Próspera's regulatory sandbox.\n\nNo complex bureaucracy - just a clear, streamlined path from idea to operation.", image: govClarity },
  { icon: Percent, title: "Low, competitive taxes", desc: "A simplified tax system with rates as low as 1%–5% and minimal reporting.\n\nKeep more of your revenue and reinvest directly into growth.", image: govEfficiency },
  { icon: Scale, title: "A community that builds", desc: "Join founders and operators actively building companies inside the ecosystem.\n\nWith over $40M raised and VCs regularly visiting, opportunities come through real connections.", image: govSupport },
  { icon: Shield, title: "Privately governed system", desc: "Operate under a modern legal framework managed by a private entity.\n\nInstead of slow regulators, insurance-based approvals allow you to move faster and launch with fewer barriers.", image: govSecurity },
  { icon: Monitor, title: "Flexible regulatory framework", desc: "Choose the best regulations from around the world - or create your own.\n\nAlready used by startups in biotech, fintech, crypto, construction, and longevity.", image: govAccess },
];

const startups = [
  { name: "Unlimited Bio", desc: "Pioneering longevity and biotechnology research to unlock human potential and extend healthspan.", url: "https://unlimited.bio/" },
  { name: "Network Bank", desc: "Modern digital banking built for entrepreneurs and global citizens operating across borders.", url: "https://www.networkbank.com/" },
  
  { name: "MuseBio", desc: "A platform that allows women to safely collect menstrual stem cells at home and contribute them to medical research in regenerative medicine.", url: "https://www.mycells.bio/" },
  { name: "PopVax", desc: "Next-generation vaccine development platform accelerating immunization solutions for global health challenges.", url: "https://popvax.com/" },
  { name: "Blink", desc: "A simple and secure Bitcoin wallet designed for everyday payments, allowing users to send, receive, and manage Bitcoin easily.", url: "https://www.blink.sv/" },
  { name: "RealityNet", desc: "A decentralized network that verifies data, logic, and execution across systems and devices to ensure reliability and consistency without central control.", url: "https://realitynet.xyz/" },
];

const MissionSection = () => {
  const title1Ref = useGsapTitle<HTMLHeadingElement>();
  const title2Ref = useGsapTitle<HTMLHeadingElement>();
  const title3Ref = useGsapTitle<HTMLHeadingElement>();
  const sliderRef = useRef<HTMLDivElement>(null);
  const slider2Ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [canScroll2Left, setCanScroll2Left] = useState(false);
  const [canScroll2Right, setCanScroll2Right] = useState(true);

  const checkScroll = () => {
    const el = sliderRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  const checkScroll2 = () => {
    const el = slider2Ref.current;
    if (!el) return;
    setCanScroll2Left(el.scrollLeft > 10);
    setCanScroll2Right(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll);
    return () => el.removeEventListener("scroll", checkScroll);
  }, []);

  useEffect(() => {
    const el = slider2Ref.current;
    if (!el) return;
    checkScroll2();
    el.addEventListener("scroll", checkScroll2);
    return () => el.removeEventListener("scroll", checkScroll2);
  }, []);

  const scroll = (dir: "left" | "right") => {
    const el = sliderRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  const scroll2 = (dir: "left" | "right") => {
    const el = slider2Ref.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section className="py-24 md:py-32">
      <div className="px-8 md:px-12">

        {/* Block 1 — Community (editorial layout like reference) */}
        <div className="mb-32">
          <div className="flex items-baseline gap-4 mb-6">
            <span className="text-xs tracking-[0.15em]" style={{ color: textMuted }}>/01</span>
          </div>
          <h2
            ref={title1Ref}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light tracking-tight leading-[1.1] max-w-4xl mb-16"
            style={{ color: textDark }}
          >
            We build a community
          </h2>

          <div className="max-w-md mb-12">
            <p className="text-sm md:text-base font-light leading-relaxed" style={{ color: textMuted }}>
              A curated network of founders, creators, and ambitious minds. People who come here not just to live — but to build, collaborate, and shape the future together.
            </p>
          </div>

          <div className="w-full h-[50vh] rounded-2xl overflow-hidden">
            <img
              src={communityImg1}
              alt="Community collaboration"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

      </div>

      {/* Block 2 — Governance (full-width slider) */}
      <div className="mt-32">
        <div className="px-8 md:px-12">
          <div className="flex items-end justify-between pb-6 mb-8">
            <div>
              <span className="text-xs tracking-[0.15em] block mb-4" style={{ color: textMuted }}>/02</span>
              <h2 ref={title2Ref} className="text-4xl md:text-6xl font-light tracking-tight mb-6" style={{ color: textDark }}>
                Designed for builders to connect, create, and grow
              </h2>
              <div className="max-w-lg">
                <p className="text-sm md:text-base font-light leading-relaxed mb-4" style={{ color: textMuted }}>
                  Everything here is designed to remove friction and accelerate execution.
                </p>
                <p className="text-sm md:text-base font-light leading-relaxed" style={{ color: textMuted }}>
                  From clear systems to a supportive environment — you focus on building, we handle the rest.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => scroll("left")}
                className="w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-300 hover:bg-[hsl(0_0%_10%)] hover:text-white"
                style={{
                  borderColor: borderLight,
                  color: canScrollLeft ? textDark : "hsl(0 0% 80%)",
                  opacity: canScrollLeft ? 1 : 0.4,
                }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => scroll("right")}
                className="w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-300 hover:bg-[hsl(0_0%_10%)] hover:text-white"
                style={{
                  borderColor: borderLight,
                  color: canScrollRight ? textDark : "hsl(0 0% 80%)",
                  opacity: canScrollRight ? 1 : 0.4,
                }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <div
          ref={sliderRef}
          className="flex gap-5 overflow-x-auto pb-4"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          <div className="flex-shrink-0 w-8 md:w-12" />
          {governanceItems.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="group relative rounded-2xl overflow-hidden cursor-default flex flex-col justify-between flex-shrink-0"
                style={{
                  background: i % 2 === 0
                    ? "linear-gradient(180deg, hsl(0 0% 8%) 0%, hsl(8 80% 30%) 50%, hsl(16 90% 45%) 100%)"
                    : "linear-gradient(180deg, hsl(0 0% 8%) 0%, hsl(12 85% 35%) 60%, hsl(25 95% 55%) 100%)",
                  width: "min(420px, 75vw)",
                  height: "520px",
                }}
              >
                {/* Hover background image + overlay */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0"
                >
                  <img
                    src={item.image}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/60" />
                </div>

                <div className="relative z-10 p-8 pt-10">
                    <h3 className="text-3xl md:text-4xl font-light text-white">
                      {item.title}
                    </h3>
                </div>
                <div className="relative z-10 p-8 pb-10">
                  <Icon className="w-6 h-6 text-white/30 mb-4" />
                  <p className="text-base text-white/75 font-light leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
          <div className="flex-shrink-0 w-8 md:w-12" />
        </div>
      </div>

      {/* Block 3 — Startups (full-width slider) */}
      <div className="mt-32">
        <div className="px-8 md:px-12">
          <div className="flex items-end justify-between pb-6 mb-8">
            <div>
              <span className="text-xs tracking-[0.15em] block mb-4" style={{ color: textMuted }}>/03</span>
              <h2 ref={title3Ref} className="text-4xl md:text-6xl font-light tracking-tight" style={{ color: textDark }}>
                Which leads to startups, ideas, and real opportunities
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => scroll2("left")}
                className="w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-300 hover:bg-[hsl(0_0%_10%)] hover:text-white"
                style={{
                  borderColor: borderLight,
                  color: canScroll2Left ? textDark : "hsl(0 0% 80%)",
                  opacity: canScroll2Left ? 1 : 0.4,
                }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => scroll2("right")}
                className="w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-300 hover:bg-[hsl(0_0%_10%)] hover:text-white"
                style={{
                  borderColor: borderLight,
                  color: canScroll2Right ? textDark : "hsl(0 0% 80%)",
                  opacity: canScroll2Right ? 1 : 0.4,
                }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <div
          ref={slider2Ref}
          className="flex gap-5 overflow-x-auto pb-4"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          <div className="flex-shrink-0 w-8 md:w-12" />
          {startups.map((item, i) => {
            const Wrapper = item.url ? 'a' : 'div';
            const linkProps = item.url ? { href: item.url, target: "_blank", rel: "noopener noreferrer" } : {};
            return (
              <Wrapper
                key={item.name}
                {...linkProps}
                className={`group relative rounded-2xl overflow-hidden flex flex-col justify-between flex-shrink-0 ${item.url ? 'cursor-pointer' : 'cursor-default'}`}
                style={{
                  background: i % 2 === 0
                    ? "linear-gradient(180deg, hsl(0 0% 8%) 0%, hsl(8 80% 30%) 50%, hsl(16 90% 45%) 100%)"
                    : "linear-gradient(180deg, hsl(0 0% 8%) 0%, hsl(12 85% 35%) 60%, hsl(25 95% 55%) 100%)",
                  width: "min(420px, 75vw)",
                  height: "520px",
                }}
              >
                <div className="p-8 pt-10">
                  <h3 className="text-3xl md:text-4xl font-light text-white">
                    {item.name}
                  </h3>
                </div>
                <div className="p-8 pb-10">
                  <p className="text-base text-white/75 font-light leading-relaxed">
                    {item.desc}
                  </p>
                  {item.url && (
                    <span className="inline-flex items-center gap-2 text-sm text-white/50 mt-4 group-hover:text-white transition-colors">
                      Detail more <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </div>
              </Wrapper>
            );
          })}
          <div className="flex-shrink-0 w-8 md:w-12" />
        </div>
      </div>
    </section>
  );
};

export default MissionSection;