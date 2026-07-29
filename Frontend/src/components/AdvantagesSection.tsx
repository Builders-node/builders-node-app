import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGsapTitle } from "@/hooks/useGsapTitle";
import { Building2, Globe, Laptop, Dumbbell, Waves, Trophy, Utensils, CircleDot, HeartPulse, BookOpen, Sparkles } from "lucide-react";

import advRoom from "@/assets/adv-room.jpg";
import advEresidency from "@/assets/adv-eresidency.jpg";
import advCoworking from "@/assets/adv-coworking.jpg";
import advGym from "@/assets/gallery-3.jpg";
import advPool from "@/assets/adv-pool.jpg";
import advTennis from "@/assets/adv-tennis.jpg";

import advMeals from "@/assets/apply-food.png";
import advFitness from "@/assets/adv-fitness.jpg";
import advWorkshops from "@/assets/gallery-5.jpg";

const advantages = [
  { num: "/01", icon: Building2, title: "Duna Tower Service Room", tags: "ACCOMMODATION, PREMIUM", image: advRoom, description: "Fully furnished rooms designed for comfort and focus.\nLive in a space that supports both rest and productivity." },
  { num: "/02", icon: Globe, title: "E-Residency", tags: "DIGITAL, GOVERNANCE", image: advEresidency, description: "Digital residency program enabling you to establish legal presence, open bank accounts, and operate businesses remotely." },
  { num: "/03", icon: Laptop, title: "Infinita Coworking", tags: "WORKSPACE, OCEAN VIEW", image: advCoworking, description: "State-of-the-art coworking space with high-speed internet, meeting rooms, and panoramic Caribbean views." },
  { num: "/04", icon: Dumbbell, title: "Las Verandas & Duna Gym", tags: "FITNESS, WELLNESS", image: advGym, description: "Access two fully equipped gyms for training and recovery. Stay energized and perform at your best." },
  { num: "/05", icon: Waves, title: "Las Verandas & Duna Pool", tags: "LEISURE, RESORT", image: advPool, description: "Resort-style infinity pool overlooking the Caribbean Sea, with poolside bar and lounge areas." },
  { num: "/06", icon: Trophy, title: "Tennis Court", tags: "SPORTS, LAS VERANDAS", image: advTennis, description: "You get access to a tennis court designed for performance and connection - where every match becomes an opportunity to improve your game, meet driven people, and be part of a high-level community." },
  
  { num: "/07", icon: Utensils, title: "Nutrition Meals", tags: "COMING SOON", image: advMeals, description: "Clean, balanced meals designed for performance. A full meal plan with three daily meals, delivered consistently." },
  { num: "/08", icon: CircleDot, title: "Pickleball Court", tags: "SPORTS, COMMUNITY", image: advTennis, description: "Fast-growing sport perfect for networking and fun. Play pickleball in a resort setting with fellow entrepreneurs." },
  { num: "/09", icon: HeartPulse, title: "Fitness Classes", tags: "WELLNESS, GROUP", image: advFitness, description: "Group fitness sessions led by professional trainers. From HIIT to yoga, stay active and build connections." },
  { num: "/10", icon: BookOpen, title: "Workshops", tags: "EDUCATION, GROWTH", image: advWorkshops, description: "Regular workshops on business, technology, and personal development. Learn from experts and fellow community members." },
  { num: "/11", icon: Sparkles, title: "Cleaning Service", tags: "HOUSEKEEPING, MAINTENANCE", image: advRoom, description: "Regular housekeeping and cleaning services included with your stay. Focus on your work while we handle the upkeep of your living space." },
];

const textDark = "hsl(0 0% 10%)";
const textMuted = "hsl(0 0% 45%)";
const borderLight = "hsl(0 0% 10% / 0.12)";

const AdvantagesSection = () => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tappedIndex, setTappedIndex] = useState<number | null>(null);
  const isMobile = useIsMobile();
  const titleRef = useGsapTitle<HTMLHeadingElement>();

  return (
    <section className="py-24 md:py-32 px-8 md:px-12">
      <div>
        {/* Header */}
        <div className="mb-16">
          <p className="text-xs tracking-[0.25em] uppercase mb-4" style={{ color: textMuted }}>
            Advantages
          </p>
          <h2 ref={titleRef} className="text-4xl md:text-6xl font-light tracking-tight mb-5" style={{ color: textDark }}>
            Starting at $1,950/month
          </h2>
          <p className="text-base md:text-lg font-light max-w-lg" style={{ color: textMuted }}>
            Your membership includes everything, from room to food to gym. First arrivals from September 1, 2026.
          </p>
        </div>

        {/* List rows with expandable content */}
        <div>
          {advantages.map((item, i) => {
            const isOpen = isMobile || hoveredIndex === i || tappedIndex === i;
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="border-b cursor-pointer md:cursor-default"
                style={{ borderColor: borderLight }}
                onClick={() => setTappedIndex(tappedIndex === i ? null : i)}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Row header */}
                <div className="flex items-center justify-between py-7 md:py-9">
                  <div className="flex items-center gap-4">
                    <span className="text-xs tracking-[0.15em] w-8" style={{ color: textMuted }}>
                      {item.num}
                    </span>
                    <Icon
                      className="w-5 h-5 transition-colors duration-300 hidden md:block"
                      style={{ color: isOpen ? "hsl(16 90% 45%)" : "hsl(0 0% 30%)" }}
                    />
                    <h3
                      className="text-xl md:text-2xl font-light transition-colors duration-300"
                      style={{ color: isOpen ? "hsl(16 90% 45%)" : textDark }}
                    >
                      {item.title}
                    </h3>
                  </div>
                  <span
                    className="text-[11px] tracking-[0.2em] uppercase hidden md:block"
                    style={{ color: textMuted }}
                  >
                    {item.tags}
                  </span>
                </div>

                {/* Expandable description + image */}
                <div
                  className="overflow-hidden transition-all duration-500 ease-out"
                  style={{
                    maxHeight: isOpen ? "400px" : "0px",
                    opacity: isOpen ? 1 : 0,
                  }}
                >
                  <div className="flex flex-col md:flex-row gap-6 pb-8 pt-2 pl-12 md:pl-16">
                    <div className="w-full md:w-72 h-48 flex-shrink-0 rounded-sm overflow-hidden">
                      <img
                        src={item.image}
                        alt={item.title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p
                      className="text-sm md:text-base leading-relaxed max-w-md whitespace-pre-line"
                      style={{ color: textMuted }}
                    >
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default AdvantagesSection;
