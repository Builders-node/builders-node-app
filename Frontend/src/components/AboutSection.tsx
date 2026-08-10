import { useGsapTitle } from "@/hooks/useGsapTitle";
import { useBatch } from "@/lib/batch";
import { useStartingPrice } from "@/lib/membership-plans";
import about1 from "@/assets/gallery-1.jpg";
import about2 from "@/assets/gallery-2.jpg";
import about3 from "@/assets/gallery-3.jpg";

const AboutSection = () => {
  const titleRef = useGsapTitle<HTMLHeadingElement>();
  const batch = useBatch();
  // Quoted from the plan catalogue, so a price change in the admin reaches
  // the landing too — this sentence used to name its own number.
  const { price: startingPrice } = useStartingPrice();
  return (
    <section
      id="about"
      className="py-20 md:py-32 px-8 md:px-12"
      style={{ backgroundColor: "hsl(30 30% 93%)" }}
    >
      {/* Top large statement */}
      <div className="max-w-4xl mb-20 md:mb-32">
        <h2
          ref={titleRef}
          className="text-3xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.15]"
          style={{ color: "hsl(0 0% 10%)" }}
        >
          Builders Node is a frontier community for techno-optimists — blending self-improvement with startup society building.
        </h2>
      </div>

      {/* Bottom two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-12 md:gap-20">
        {/* Left column - label + photos */}
        <div>
          <p
            className="text-xs tracking-[0.2em] uppercase mb-8"
            style={{ color: "hsl(0 0% 40%)" }}
          >
            Our Community
          </p>

          <div className="flex gap-3 items-end">
            <div className="w-28 h-28 rounded-full overflow-hidden">
              <img loading="lazy" decoding="async"
                src={about1}
                alt="Community life"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="w-24 h-24 rounded-full overflow-hidden">
              <img loading="lazy" decoding="async"
                src={about2}
                alt="Community life"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="w-20 h-20 rounded-full overflow-hidden">
              <img loading="lazy" decoding="async"
                src={about3}
                alt="Community life"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Right column - title + text + link */}
        <div>
          <h3
            className="text-xl md:text-2xl font-medium mb-6"
            style={{ color: "hsl(0 0% 10%)" }}
          >
            Where ambition meets community.
          </h3>

          <p
            className="text-base leading-relaxed mb-6"
            style={{ color: "hsl(0 0% 30%)" }}
          >
            Our members are founders, investors, startup workers, digital nomads, online creators, engineers and self-improvers. You should apply if you want to build yourself up and join the society of like minded people who never stop.
          </p>

          <p
            className="text-base leading-relaxed mb-10"
            style={{ color: "hsl(0 0% 30%)" }}
          >
            If you're accepted to Builders Node, membership starts at {startingPrice}/month and includes everything from meals to gym to accommodations. We think of it as society-as-a-service. First arrivals join us from {batch.longDate} — you might be in the first batch.
          </p>

          {/* Leaves the site now, so it opens in its own tab — a visitor part
              way down the landing page shouldn't lose it to read a post. */}
          <a
            href="https://x.com/syrtsov_ivan/status/2085041095109419206"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.15em] border-b pb-1 transition-opacity hover:opacity-70"
            style={{ color: "hsl(0 0% 10%)", borderColor: "hsl(0 0% 10%)" }}
          >
            Learn more about us
            <span className="text-lg">→</span>
          </a>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
