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
import eventPoker from "@/assets/event-poker.jpg";
import eventCommunity from "@/assets/event-community.jpg";
import eventProspera from "@/assets/event-prospera.jpg";

type EventType = { title: string; description: string; category: string; date: string; location?: string; image: string; link: string; type: "upcoming" | "previous" };

// External event photos sourced from infinita.city and luma
const lumaCovers = {
  bioHub: "https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover,dpr=2,quality=75,width=800/event-covers/84/fe22633a-3335-4e63-8717-e154b9131d11.png",
  libertySummit: "https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover,dpr=2,quality=75,width=800/event-covers/ms/5ed7a899-3297-44bb-854c-5f2d118fd40b.png",
  infiniteGames: "https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover,dpr=2,quality=75,width=800/event-covers/xw/415840e7-97ea-4667-a823-4e9203866d49.webp",
  longevityBio: "https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover,dpr=2,quality=75,width=800/event-covers/ce/1b383b80-97e4-452e-af0a-d6d82e4579ea.png",
  predictions: "https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover,dpr=2,quality=75,width=800/event-covers/nh/8c1f1a67-77e6-453b-8f85-a1f705d4d149.png",
  paintball: "https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover,dpr=2,quality=75,width=800/event-covers/1n/33f894f6-4831-482c-a63e-2a728da75b21.png",
  debates: "https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover,dpr=2,quality=75,width=800/event-covers/6o/12e418b4-c05c-499d-9cde-90642debe6e8.png",
  townHall: "https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover,dpr=2,quality=75,width=800/event-covers/4q/082693a1-658c-4f3b-b57e-6f4b5c2902f2.png",
  knifeFights: "https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover,dpr=2,quality=75,width=800/event-covers/c8/77d08cf7-d6c9-4ac7-baf4-4df098c5a457.png",
  talentShow: "https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover,dpr=2,quality=75,width=800/event-covers/av/5af0a4ac-f4d6-4ded-b7d9-3e13d82bd564.png",
  federalism: "https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover,dpr=2,quality=75,width=800/event-covers/05/95dd7846-411d-4506-a723-a15cbe711605.jpg",
};

const allEvents: EventType[] = [
  // Featured — the six flagship events (local photos)
  { title: "Liberty Acceleration Summit 2026", description: "A conference bringing together leaders in governance innovation, free cities, and startup societies to discuss the future of liberty.", category: "CONFERENCE", date: "Mar 26, 2026", location: "Próspera, Roatán", image: libertySummit, link: "https://luma.com/lib_acc2026", type: "previous" },
  { title: "BTC Chess", description: "The first-ever Bitcoin Chess Championship held in Próspera, bringing together chess enthusiasts and crypto advocates.", category: "CHESS", date: "Mar 16, 2026", location: "Próspera, Roatán", image: btcChess, link: "https://btc960champ.com", type: "previous" },
  { title: "Limit Break", description: "A half-marathon through the scenic trails of Roatán, challenging runners to push their limits in a tropical paradise.", category: "BODY GAMES", date: "Mar 29, 2026", location: "Próspera, Roatán", image: limitBreak, link: "https://luma.com/Marathon2026", type: "previous" },
  { title: "bitchill", description: "A cozy Bitcoin retreat in the Caribbean — sunny activities, cultural events, and bitcoin open mic on the island of Roatán.", category: "BITCOIN", date: "Apr 16-25, 2026", location: "Próspera, Roatán", image: bitchillImg, link: "https://www.prospera.co/en", type: "previous" },
  { title: "Free Cities", description: "The annual gathering of the global Free Cities community with speakers from the world's leading free city projects.", category: "CONFERENCE", date: "Sep 3-6, 2026", location: "Próspera, Roatán", image: freeCities, link: "https://www.prospera.co/en", type: "upcoming" },
  { title: "TEDx", description: "The first-ever TEDx event on Roatán, bringing together inspiring speakers, bold ideas, and the vibrant island community.", category: "CONFERENCE", date: "Apr 9, 2026", location: "Roatán", image: tedxImg, link: "https://www.prospera.co/en", type: "previous" },
  // Upcoming (from prospera.co)
  { title: "BJJ Adventures with Cyborg", description: "Train, compete, and recover alongside Roberto Cyborg Abreu in an immersive experience combining world-class BJJ, ocean adventures, and community.", category: "SPORTS", date: "Apr 2-5, 2026", location: "Próspera, Roatán", image: eventProspera, link: "https://www.prospera.co/en", type: "upcoming" },
  { title: "Próspera Weekend", description: "Experience Próspera firsthand with guided tours, networking events, and opportunities to meet residents and entrepreneurs building the future.", category: "COMMUNITY", date: "Apr 24-26, 2026", location: "Próspera, Roatán", image: eventProspera, link: "https://www.prospera.co/en", type: "upcoming" },
  { title: "Pop-Up Island — Regenerative District", description: "15 days to found a Regenerative Impact Special Economic Zone in Próspera — design governance, impact measurement, and the founding charter.", category: "GOVERNANCE", date: "May 5-19, 2026", location: "Próspera, Roatán", image: lumaCovers.libertySummit, link: "https://www.prospera.co/en", type: "upcoming" },
  { title: "Noma Family", description: "A family-friendly coliving experience in Roatán. Work, adventure, wellness, and community for families exploring a new way of living.", category: "COLIVING", date: "Jul 5 - Aug 2, 2026", location: "Próspera, Roatán", image: eventCommunity, link: "https://www.prospera.co/en", type: "upcoming" },
  // Previous (from Luma InfinitaCity)
  { title: "BioHub Startup Accelerator Program & Demo Day", description: "Biotech startups presented their innovations after an intensive accelerator program focused on longevity and health tech.", category: "STARTUP", date: "Mar 28, 2026", location: "Próspera", image: lumaCovers.bioHub, link: "https://luma.com/BioHub2026", type: "previous" },
  { title: "Electric-Knife Fights Championship & Cyberpunk Rave", description: "A unique fusion of competitive electric-knife fights and a cyberpunk-themed rave at the DUNA Tower.", category: "FRONTIER GAMES", date: "Mar 21, 2026", location: "DUNA Tower", image: lumaCovers.knifeFights, link: "https://luma.com/eKFC2026", type: "previous" },
  { title: "Talent Show", description: "A community talent show showcasing the diverse creative abilities of Infinita City residents and visitors.", category: "SOCIAL GAMES", date: "Mar 7, 2026", location: "Próspera", image: lumaCovers.talentShow, link: "https://luma.com/ri4g409z", type: "previous" },
  { title: "/BTC Poker Championship", description: "A high-stakes poker tournament where Bitcoin meets competitive card play in Próspera's vibrant community.", category: "POKER", date: "Mar 4, 2026", location: "Próspera", image: eventPoker, link: "https://btcpokerchamp.com", type: "previous" },
  { title: "Paintball Battlezone Roatán", description: "An action-packed paintball battle at Mayan Eden eco park on the island of Roatán.", category: "FRONTIER GAMES", date: "Feb 28, 2026", location: "Roatán", image: lumaCovers.paintball, link: "https://luma.com/CyberPaintball2026", type: "previous" },
  { title: "Super Debates Battle", description: "A competitive debate event challenging participants to defend their ideas on stage at Próspera.", category: "MIND GAMES", date: "Feb 20, 2026", location: "Próspera", image: lumaCovers.debates, link: "https://luma.com/DebatesBattle2026", type: "previous" },
  { title: "Longevity Biomarkers Competition", description: "Teams competed to demonstrate the best approaches to measuring and improving longevity biomarkers.", category: "BIOTECH", date: "Feb 6, 2026", location: "DUNA Tower", image: lumaCovers.longevityBio, link: "https://luma.com/RejuveAI2026", type: "previous" },
  { title: "Infinite Games 2026", description: "The flagship multi-week event combining conferences, competitions, and community across crypto cities, biotech, and network states.", category: "CONFERENCE", date: "Feb 1, 2026", location: "Próspera", image: lumaCovers.infiniteGames, link: "https://luma.com/infinite-games", type: "previous" },
  { title: "Prediction Markets Arena", description: "A virtual competition exploring prediction markets and collective intelligence strategies.", category: "MIND GAMES", date: "Feb 1, 2026", location: "Virtual", image: lumaCovers.predictions, link: "https://luma.com/Markets2026", type: "previous" },
  { title: "Infinite Games Town Hall", description: "A community town hall to discuss the upcoming Infinite Games 2026 program and logistics.", category: "COMMUNITY", date: "Jan 21, 2026", location: "Virtual", image: lumaCovers.townHall, link: "https://luma.com/IG26-townhall", type: "previous" },
  { title: "American Federalism 2.0 — Biotech Acceleration", description: "A discussion on state-regulated pathways for biotech acceleration with special guest Jim O'Neill.", category: "BIOTECH", date: "Jan 13, 2026", location: "Virtual", image: lumaCovers.federalism, link: "https://luma.com/federalism2.0", type: "previous" },
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
