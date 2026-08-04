import { useGsapTitle } from "@/hooks/useGsapTitle";
import timUrbanImg from "@/assets/tim-urban.webp";
import sidSijbrandijImg from "@/assets/sid-sijbrandij.webp";
import bryanJohnsonImg from "@/assets/bryan-johnson.webp";
import timDraperImg from "@/assets/tim-draper.webp";
import aubreyDeGreyImg from "@/assets/aubrey-de-grey.webp";
import navalRavikantImg from "@/assets/naval-ravikant.webp";
import balajiImg from "@/assets/balaji-srinivasan.webp";
import brianArmstrongImg from "@/assets/brian-armstrong.webp";

interface Speaker {
  name: string;
  role: string;
  imageUrl: string;
  xUrl?: string;
}

const speakers: Speaker[] = [
  {
    name: "Balaji Srinivasan",
    role: "Author, The Network State",
    imageUrl: balajiImg,
    xUrl: "https://x.com/balajis",
  },
  {
    name: "Brian Armstrong",
    role: "Cofounder, Coinbase",
    imageUrl: brianArmstrongImg,
    xUrl: "https://x.com/brian_armstrong",
  },
  {
    name: "Tim Draper",
    role: "Founder, Draper Associates",
    imageUrl: timDraperImg,
    xUrl: "https://x.com/TimDraper",
  },
  {
    name: "Bryan Johnson",
    role: "Founder, Don't Die",
    imageUrl: bryanJohnsonImg,
    xUrl: "https://x.com/bryan_johnson",
  },
  {
    name: "Naval Ravikant",
    role: "Cofounder, AngelList",
    imageUrl: navalRavikantImg,
    xUrl: "https://x.com/naval",
  },
  {
    name: "Aubrey de Grey",
    role: "Longevity Researcher",
    imageUrl: aubreyDeGreyImg,
    xUrl: "https://x.com/aubreydegrey",
  },
  {
    name: "Tim Urban",
    role: "Author, Wait But Why",
    imageUrl: timUrbanImg,
    xUrl: "https://x.com/waitbutwhy",
  },
  {
    name: "Sytse 'Sid' Sijbrandij",
    role: "CEO, GitLab",
    imageUrl: sidSijbrandijImg,
    xUrl: "https://x.com/saboressen",
  },
];

const SpeakersSection = () => {
  const titleRef = useGsapTitle<HTMLHeadingElement>();

  return (
    <section
      className="py-24 md:py-32 relative overflow-hidden"
      style={{ backgroundColor: "hsl(30 30% 93%)", color: "hsl(0 0% 10%)" }}
    >
      {/* Subtle network pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="px-8 md:px-12 mb-16 md:mb-20">
          <p className="text-xs tracking-[0.25em] uppercase mb-4 text-muted-foreground">
            Notable Guests
          </p>
          <h2
            ref={titleRef}
            className="text-4xl md:text-6xl lg:text-7xl font-light tracking-tight mb-5"
          >
            People Who Came to Us
          </h2>
          <p className="text-base md:text-lg font-light max-w-2xl text-muted-foreground">
            Founders, investors, researchers, and builders who visited Próspera and joined the Builders Node community.
          </p>
        </div>

        {/* Mobile: horizontal slider / Desktop: grid */}
        <div className="md:hidden flex overflow-x-auto gap-4 snap-x snap-mandatory scrollbar-hide pb-4 pl-8" style={{ scrollPaddingLeft: '2rem' }}>
          {speakers.map((speaker, i) => {
            const gradients = [
              "linear-gradient(135deg, hsl(350 60% 40%), hsl(280 40% 30%))",
              "linear-gradient(135deg, hsl(160 50% 35%), hsl(200 60% 25%))",
              "linear-gradient(135deg, hsl(30 70% 50%), hsl(350 50% 40%))",
              "linear-gradient(135deg, hsl(120 50% 35%), hsl(80 60% 45%))",
              "linear-gradient(135deg, hsl(220 50% 35%), hsl(260 40% 25%))",
              "linear-gradient(135deg, hsl(40 60% 50%), hsl(20 70% 40%))",
            ];
            const gradient = gradients[i % gradients.length];
            return (
              <a
                key={i}
                href={speaker.xUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative rounded-2xl overflow-hidden flex-shrink-0 w-[70vw] aspect-[3/4] flex flex-col justify-end snap-start"
                style={{ background: gradient }}
              >
                <img loading="lazy" decoding="async"
                  src={speaker.imageUrl}
                  alt={speaker.name}
                  className="absolute inset-0 w-full h-full object-cover object-top"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(speaker.name)}&background=1a1a1a&color=666&size=400`;
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="relative z-10 p-5">
                  <h3 className="font-medium text-base text-white leading-tight mb-1">{speaker.name}</h3>
                  <p className="text-sm font-light text-white/70">{speaker.role}</p>
                </div>
              </a>
            );
          })}
          <div className="shrink-0 w-4" />
        </div>

        {/* Desktop grid */}
        <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-4 gap-6 md:px-12">
          {speakers.map((speaker, i) => {
            const gradients = [
              "linear-gradient(135deg, hsl(350 60% 40%), hsl(280 40% 30%))",
              "linear-gradient(135deg, hsl(160 50% 35%), hsl(200 60% 25%))",
              "linear-gradient(135deg, hsl(30 70% 50%), hsl(350 50% 40%))",
              "linear-gradient(135deg, hsl(120 50% 35%), hsl(80 60% 45%))",
              "linear-gradient(135deg, hsl(220 50% 35%), hsl(260 40% 25%))",
              "linear-gradient(135deg, hsl(40 60% 50%), hsl(20 70% 40%))",
            ];
            const gradient = gradients[i % gradients.length];
            return (
              <a
                key={i}
                href={speaker.xUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative rounded-2xl overflow-hidden aspect-[3/4] flex flex-col justify-end"
                style={{ background: gradient }}
              >
                <img loading="lazy" decoding="async"
                  src={speaker.imageUrl}
                  alt={speaker.name}
                  className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(speaker.name)}&background=1a1a1a&color=666&size=400`;
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="relative z-10 p-5">
                  <h3 className="font-medium text-base md:text-lg text-white leading-tight mb-1">{speaker.name}</h3>
                  <p className="text-sm font-light text-white/70">{speaker.role}</p>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default SpeakersSection;
