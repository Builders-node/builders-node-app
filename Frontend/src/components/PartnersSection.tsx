import { useGsapTitle } from "@/hooks/useGsapTitle";
import nomadzLogo from "@/assets/nomadz-logo.png";
import infinitaLogo from "@/assets/infinita-logo.png";

const partners = [
  { name: "Nomadz", logo: nomadzLogo, url: "https://nomadz.xyz/", isImage: true },
  { name: "Infinita", logo: infinitaLogo, url: "https://infinita.city", isImage: true },
  { name: "Próspera", logo: "PRÓSPERA", url: "https://prospera.co" },
];

const textDark = "hsl(0 0% 10%)";
const textMuted = "hsl(0 0% 45%)";
const borderLight = "hsl(0 0% 10% / 0.12)";

const PartnersSection = () => {
  const titleRef = useGsapTitle<HTMLHeadingElement>();
  return (
    <section className="py-20 md:py-28 px-8 md:px-12">
      <div>
        <div className="mb-16">
          <h2 ref={titleRef} className="text-5xl md:text-7xl font-light tracking-tight" style={{ color: textDark }}>
            Community built by
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 items-center justify-items-center">
          {partners.map((p) => (
            <a
              key={p.name}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-center w-full h-24 rounded-lg transition-all duration-300 hover:scale-105"
              style={{ border: `1px solid ${borderLight}` }}
            >
              {p.isImage ? (
                <img src={p.logo} alt={p.name} className="h-8 md:h-10 object-contain opacity-40 group-hover:opacity-70 transition-opacity duration-300" />
              ) : (
                <span
                  className="text-lg md:text-xl font-semibold tracking-wider opacity-40 group-hover:opacity-70 transition-opacity duration-300"
                  style={{ color: textDark }}
                >
                  {p.logo}
                </span>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PartnersSection;
