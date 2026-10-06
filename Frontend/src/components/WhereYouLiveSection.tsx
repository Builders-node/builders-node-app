import { useGsapTitle } from "@/hooks/useGsapTitle";

/**
 * Where the tower is: a short orientation on Roatán and Próspera beside a map.
 *
 * The map is OpenStreetMap's own embed rather than a map library — one
 * iframe, nothing added to the bundle, and it brings its own zoom controls.
 * Framed on the whole island rather than the street, because the question a
 * reader has at this point is "where in the world is this", not "which door".
 */

/** Duna Tower, Próspera — the same point the Duna Residence site uses. */
const DUNA_TOWER = { lat: 16.3789, lng: -86.4423 };
/** West end to past Oak Ridge: the island, with the tower in it. */
const ISLAND_BBOX = [-86.56, 16.3, -86.3, 16.45].join(",");
const MAP_SRC = `https://www.openstreetmap.org/export/embed.html?bbox=${ISLAND_BBOX}&layer=mapnik&marker=${DUNA_TOWER.lat},${DUNA_TOWER.lng}`;

// The landing's own palette and type: light headings, muted body, the
// same accent as everywhere else.
const textDark = "hsl(0 0% 10%)";
const textMuted = "hsl(0 0% 45%)";
const borderLight = "hsl(0 0% 10% / 0.12)";
const accent = "#EA5404";

const WhereYouLiveSection = () => {
  const titleRef = useGsapTitle<HTMLHeadingElement>();
  return (
  <section id="location" className="py-24 md:py-32 px-8 md:px-12" style={{ backgroundColor: "hsl(30 30% 93%)" }}>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
      <div>
        <h2 ref={titleRef} className="text-4xl md:text-6xl font-light tracking-tight mb-8" style={{ color: textDark }}>
          Where you&apos;ll live
        </h2>
        <p className="text-base md:text-lg font-light leading-relaxed mb-6" style={{ color: textMuted }}>
          Roatán is a 60 km island off the north coast of Honduras, sitting on the Mesoamerican Barrier Reef — the
          second-largest reef system in the world. It&apos;s warm all year, roughly 26–30°C.
        </p>
        <p className="text-base md:text-lg font-light leading-relaxed mb-10" style={{ color: textMuted }}>
          Próspera is a private charter city on the island, with its own regulatory framework for business. Duna Tower
          is its first residential building, a short walk from the water.
        </p>
        <a
          href="https://prospera.co"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.15em] border-b pb-1 transition-opacity hover:opacity-70"
          style={{ color: textDark, borderColor: textDark }}
        >
          Learn more about Próspera
          <span className="text-lg">→</span>
        </a>
      </div>

      <div
        className="relative w-full overflow-hidden rounded-2xl border"
        style={{ height: "clamp(320px, 42vw, 460px)", borderColor: borderLight }}
      >
        <iframe
          title="Map of Roatán with Duna Tower, Próspera"
          src={MAP_SRC}
          loading="lazy"
          className="absolute inset-0 w-full h-full"
          style={{ border: 0 }}
        />
        {/* Over the map, not part of it: the embed can't label its marker. */}
        <div
          className="absolute top-3 left-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] tracking-[0.2em] uppercase font-semibold pointer-events-none"
          style={{ backgroundColor: textDark, color: "#fff" }}
        >
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: accent }} aria-hidden="true" />
          Duna Tower, Próspera
        </div>
      </div>
    </div>
  </section>
  );
};

export default WhereYouLiveSection;
