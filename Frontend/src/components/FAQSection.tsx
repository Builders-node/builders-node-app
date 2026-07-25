import { Plus, Minus } from "lucide-react";
import { useState } from "react";
import { useGsapTitle } from "@/hooks/useGsapTitle";

const faqs = [
  {
    q: "What is Próspera?",
    a: "Próspera is a special economic zone and startup society in the Caribbean, designed for builders, creators, and entrepreneurs who want to live and work in a free, innovative environment.",
  },
  {
    q: "When can I move in?",
    a: "Our first batch of residents arrives on September 1, 2026. After that, new memberships begin on the first of every month — pick the start date that works best for you when you apply.",
  },
  {
    q: "How do I apply?",
    a: "Click the 'Apply' button to start your application. We review applications on a rolling basis and look for ambitious individuals who want to contribute to the community.",
  },
  {
    q: "What does E-Residency include?",
    a: "E-Residency gives you digital access to Próspera's jurisdiction, allowing you to register businesses, access financial services, and participate in governance — all remotely.",
  },
  {
    q: "Can I visit before committing?",
    a: "Absolutely. We encourage prospective residents to visit during one of our events — chess tournaments, poker championships, or community gatherings — to experience the lifestyle firsthand.",
  },
  {
    q: "What's included in the coworking space?",
    a: "Infinita Coworking offers high-speed internet, ocean views, and a community of like-minded entrepreneurs. Available to all residents.",
  },
  {
    q: "Is this a crypto community?",
    a: "While many of our residents are in the crypto and tech space, Próspera welcomes all types of builders and creators. The common thread is ambition and a desire for freedom.",
  },
  {
    q: "What is included in the subscription?",
    a: "You get access to premium spaces, facilities, community events, and curated experiences designed to help you grow, connect, and perform at your best.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes, you can manage or cancel your subscription based on the terms of your plan.",
  },
  {
    q: "What kind of events are included?",
    a: "You get access to curated events such as networking sessions, workshops, social gatherings, and performance-focused activities.",
  },
];

const textDark = "hsl(0 0% 10%)";
const textMuted = "hsl(0 0% 45%)";
const borderLight = "hsl(0 0% 10% / 0.12)";

const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const titleRef = useGsapTitle<HTMLHeadingElement>();

  return (
    <section className="py-24 md:py-32 px-8 md:px-12">
      <div>
        {/* Header */}
        <div className="mb-12">
          <h2 ref={titleRef} className="text-5xl md:text-7xl font-light tracking-tight" style={{ color: textDark }}>
            FAQ
          </h2>
        </div>

        {/* FAQ items */}
        <div>
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className="border-b cursor-pointer"
                style={{ borderColor: borderLight }}
                onClick={() => setOpenIndex(isOpen ? null : i)}
              >
                <div className="flex items-center justify-between py-6 md:py-8">
                  <div className="flex items-center gap-4">
                    <span className="text-xs tracking-[0.15em] w-8" style={{ color: textMuted }}>
                      /{String(i + 1).padStart(2, "0")}
                    </span>
                    <h3
                      className="text-lg md:text-xl font-light transition-colors duration-300"
                      style={{ color: isOpen ? "hsl(16 90% 45%)" : textDark }}
                    >
                      {faq.q}
                    </h3>
                  </div>
                  <div className="flex-shrink-0 ml-4" style={{ color: textMuted }}>
                    {isOpen ? <Minus className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </div>
                </div>
                <div
                  className="overflow-hidden transition-all duration-300"
                  style={{ maxHeight: isOpen ? "200px" : "0", opacity: isOpen ? 1 : 0 }}
                >
                  <p
                    className="pl-12 pr-12 pb-6 text-base leading-relaxed"
                    style={{ color: textMuted }}
                  >
                    {faq.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
