import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useGsapTitle } from "@/hooks/useGsapTitle";
import useEmblaCarousel from "embla-carousel-react";
import { useIsMobile } from "@/hooks/use-mobile";
import libertySummit from "@/assets/events/liberty-summit.png";
import btcChess from "@/assets/events/btc-chess.png";
import limitBreak from "@/assets/events/limit-break.png";
import bitchillImg from "@/assets/events/bitchill.png";
import freeCities from "@/assets/events/free-cities.png";
import tedxImg from "@/assets/events/tedx.png";

type EventType = { title: string; description: string; category: string; date: string; location?: string; image: string; link: string; type: "upcoming" | "previous" };

const allEvents: EventType[] = [
  { title: "Liberty Acceleration Summit 2026", description: "A conference bringing together leaders in governance innovation, free cities, and startup societies to discuss the future of liberty.", category: "CONFERENCE", date: "Mar 26, 2026", location: "Próspera, Roatán", image: libertySummit, link: "https://luma.com/lib_acc2026", type: "previous" },
  { title: "BTC Chess", description: "The first-ever Bitcoin Chess Championship held in Próspera, bringing together chess enthusiasts and crypto advocates.", category: "CHESS", date: "Mar 16, 2026", location: "Próspera, Roatán", image: btcChess, link: "https://btc960champ.com", type: "previous" },
  { title: "Limit Break", description: "A half-marathon through the scenic trails of Roatán, challenging runners to push their limits in a tropical paradise.", category: "BODY GAMES", date: "Mar 29, 2026", location: "Próspera, Roatán", image: limitBreak, link: "https://luma.com/Marathon2026", type: "previous" },
  { title: "bitchill", description: "A cozy Bitcoin retreat in the Caribbean — sunny activities, cultural events, and bitcoin open mic on the island of Roatán.", category: "BITCOIN", date: "Apr 16-25, 2026", location: "Próspera, Roatán", image: bitchillImg, link: "https://www.prospera.co/en", type: "previous" },
  { title: "Free Cities", description: "The annual gathering of the global Free Cities community with speakers from the world's leading free city projects.", category: "CONFERENCE", date: "Sep 3-6, 2026", location: "Próspera, Roatán", image: freeCities, link: "https://www.prospera.co/en", type: "upcoming" },
  { title: "TEDx", description: "The first-ever TEDx event on Roatán, bringing together inspiring speakers, bold ideas, and the vibrant island community.", category: "CONFERENCE", date: "Apr 9, 2026", location: "Roatán", image: tedxImg, link: "https://www.prospera.co/en", type: "previous" },
];

const tabs = ["All", "Upcoming", "Previous"] as const;
type Tab = (typeof tabs)[number];

const EventCard = ({ event }: { event: EventType }) => (
  <a
    href={event.link}
    target={event.link.startsWith("http") ? "_blank" : undefined}
    rel={event.link.startsWith("http") ? "noopener noreferrer" : undefined}
    className="group"
  >
    <div className="relative overflow-hidden rounded-lg aspect-square">
      <img src={event.image} alt={event.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
    </div>
    <div className="flex items-start justify-between mt-3 gap-2">
      <div>
        <h3 className="text-lg md:text-xl font-light leading-tight" style={{ color: "hsl(0 0% 10%)" }}>{event.title}</h3>
        <span className="text-xs tracking-[0.2em] uppercase mt-1 block" style={{ color: "hsl(0 0% 40%)" }}>{event.category}</span>
        <span className="text-[11px] tracking-wide mt-1 block" style={{ color: "hsl(0 0% 55%)" }}>{event.date}{event.location ? ` · ${event.location}` : ""}</span>
        <p className="text-xs font-light mt-2 line-clamp-3" style={{ color: "hsl(0 0% 45%)" }}>{event.description}</p>
      </div>
      <ArrowUpRight className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: "hsl(0 0% 10%)" }} />
    </div>
  </a>
);

const EventsSection = () => {
  const titleRef = useGsapTitle<HTMLHeadingElement>();
  const [activeTab, setActiveTab] = useState<Tab>("All");
  const [showAll, setShowAll] = useState(false);
  const isMobile = useIsMobile();
  const [emblaRef] = useEmblaCarousel({ align: "start", containScroll: "trimSnaps" });

  const filtered = activeTab === "All" ? allEvents : allEvents.filter((e) => e.type === activeTab.toLowerCase());
  const displayed = showAll ? filtered : filtered.slice(0, 9);

  // Reset showAll when tab changes
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setShowAll(false);
  };

  return (
    <section id="events" className="py-24 md:py-32 px-8 md:px-12" style={{ backgroundColor: "hsl(30 30% 93%)" }}>
      <div>
        <div className="flex items-end justify-between border-b border-foreground/20 pb-6 mb-8">
          <h2 ref={titleRef} className="text-5xl md:text-7xl font-light tracking-tight" style={{ color: "hsl(0 0% 10%)" }}>
            Events
          </h2>
        </div>

        <div className="flex gap-4 mb-10">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className="text-xs tracking-[0.2em] uppercase pb-1 transition-all border-b-2"
              style={{
                color: activeTab === tab ? "hsl(0 0% 10%)" : "hsl(0 0% 50%)",
                borderColor: activeTab === tab ? "hsl(0 0% 10%)" : "transparent",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {isMobile ? (
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-4">
              {displayed.map((event) => (
                <div key={event.title} className="flex-[0_0_80%] min-w-0">
                  <EventCard event={event} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {displayed.map((event) => (
              <EventCard key={event.title} event={event} />
            ))}
          </div>
        )}

        {filtered.length > 9 && !showAll && (
          <div className="flex justify-center mt-10">
            <button
              onClick={() => setShowAll(true)}
              className="px-8 py-3 rounded-full border text-sm tracking-[0.1em] uppercase transition-all duration-300 text-[hsl(0_0%_10%)] hover:bg-[hsl(0_0%_10%)] hover:text-white"
              style={{ borderColor: "hsl(0 0% 10% / 0.2)" }}
            >
              Show all events
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default EventsSection;
