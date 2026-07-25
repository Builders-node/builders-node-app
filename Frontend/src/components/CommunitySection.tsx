const textDark = "hsl(0 0% 10%)";
const textMuted = "hsl(0 0% 45%)";
const borderLight = "hsl(0 0% 10% / 0.12)";

const items = [
  { num: "/01", title: "We build a community" },
  { num: "/02", title: "Designed for builders to connect, create, and grow" },
  { num: "/03", title: "Which leads to startups, ideas, and real opportunities", startups: ["Elegix", "Darien Village", "Builders Node Sub", "Taxi Go"] },
];

const CommunitySection = () => {
  return (
    <section className="py-24 md:py-32 px-8 md:px-12" style={{ backgroundColor: "hsl(30 30% 93%)" }}>
      <div className="space-y-0">
        {items.map((item, i) => (
          <div
            key={item.num}
            className="border-b py-10 md:py-14"
            style={{ borderColor: borderLight, ...(i === 0 ? { borderTopWidth: "1px", borderTopColor: borderLight } : {}) }}
          >
            <div className="flex items-baseline gap-4 md:gap-6">
              <span className="text-xs tracking-[0.15em] flex-shrink-0" style={{ color: textMuted }}>
                {item.num}
              </span>
              <h2
                className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-light tracking-tight"
                style={{ color: textDark }}
              >
                {item.title}
              </h2>
              {"startups" in item && item.startups && (
                <div className="flex flex-wrap gap-3 mt-1 ml-1">
                  {item.startups.map((name) => (
                    <span
                      key={name}
                      className="text-xs md:text-sm tracking-[0.15em] uppercase"
                      style={{ color: textMuted }}
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default CommunitySection;
