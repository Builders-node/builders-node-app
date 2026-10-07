import { useGsapTitle } from "@/hooks/useGsapTitle";

const textDark = "hsl(0 0% 10%)";

/**
 * The main landing's "What Builders Node is": a large centred title with the
 * one-line description set large and centred beneath — an editorial layout,
 * in the landing's own type.
 */
const IntroSection = () => {
  const titleRef = useGsapTitle<HTMLHeadingElement>();

  return (
    <section id="about" className="py-24 md:py-32" style={{ backgroundColor: "hsl(30 30% 93%)" }}>
      <h2
        ref={titleRef}
        className="px-8 md:px-12 text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light tracking-tight leading-[1.02] text-center"
        style={{ color: textDark }}
      >
        What Builders Node is
      </h2>

      <p
        className="mt-12 md:mt-16 px-8 md:px-12 mx-auto max-w-5xl text-2xl sm:text-3xl md:text-4xl lg:text-[2.75rem] font-normal tracking-tight leading-[1.2] text-center"
        style={{ color: textDark }}
      >
        A coliving community where founders, builders and creators live in the same tower for 1-3 months, work on their
        own projects, and share dinners, sport and weekends.
      </p>
    </section>
  );
};

export default IntroSection;
