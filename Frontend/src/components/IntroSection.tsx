const textDark = "hsl(0 0% 10%)";
const textMuted = "hsl(0 0% 45%)";

/**
 * The main landing's "What Builders Node is", set as a statement: the name
 * small and in brackets, the description large and centred — in the
 * landing's own type.
 */
const IntroSection = () => {
  return (
    <section
      id="about"
      className="py-24 md:py-36 px-8 md:px-12 flex flex-col items-center text-center"
      style={{ backgroundColor: "hsl(30 30% 93%)" }}
    >
      <p className="text-sm md:text-base" style={{ color: textMuted }}>
        ( What Builders Node is )
      </p>

      <p
        className="mt-8 md:mt-10 max-w-4xl text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight leading-[1.15]"
        style={{ color: textDark }}
      >
        A coliving community where founders, builders and creators live in the same tower, work on their own projects,
        and share dinners, sport and weekends.
      </p>
    </section>
  );
};

export default IntroSection;
