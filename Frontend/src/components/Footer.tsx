import { useApplyNav } from "@/lib/applyNav";
import { Mail, ArrowUpRight } from "lucide-react";
import logo from "@/assets/logo.svg";

const textWhite = "hsl(0 0% 100%)";
const textWhiteMuted = "hsl(0 0% 100% / 0.6)";
const borderWhite = "hsl(0 0% 100% / 0.2)";

const socialLinks = [
  { label: "X / Twitter", href: "#" },
  { label: "Instagram", href: "#" },
  { label: "Discord", href: "https://discord.gg/Aa4jqe4dth" },
];

const Footer = () => {
  const openApply = useApplyNav();

  return (
    <>
    <footer
      id="contact"
      className="px-8 md:px-12 pt-20 pb-12"
      style={{ background: "linear-gradient(135deg, hsl(16 90% 45%), hsl(25 100% 50%))" }}
    >
      <div>
        {/* Big CTA */}
        <div className="mb-20">
          <button
            onClick={openApply}
            className="group flex items-end justify-between w-full text-left"
          >
            <h2
              className="text-5xl md:text-7xl lg:text-8xl font-light tracking-tight leading-[1] group-hover:opacity-70 transition-opacity"
              style={{ color: textWhite }}
            >
              Let's talk
            </h2>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs tracking-[0.25em] uppercase" style={{ color: textWhiteMuted }}>
                APPLY NOW
              </span>
              <div
                className="w-10 h-10 rounded-full border flex items-center justify-center group-hover:scale-110 transition-transform"
                style={{ borderColor: borderWhite, color: textWhite }}
              >
                <Mail className="w-4 h-4" />
              </div>
            </div>
          </button>
        </div>

        {/* Footer columns */}
        <div className="grid md:grid-cols-3 gap-12 mb-16">
          <div>
            <h3 className="mb-4" aria-label="Builders Node">
              <img
                src={logo}
                alt="Builders Node"
                className="h-7 w-auto"
                style={{ filter: "brightness(0) invert(1)" }}
              />
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: textWhiteMuted }}>
              Build your life in the Caribbean.
              <br />
              A startup society for builders, creators, and visionaries.
            </p>
          </div>

          <div>
            <h4 className="text-[11px] tracking-[0.25em] uppercase mb-4" style={{ color: textWhiteMuted }}>
              Navigation
            </h4>
            <div className="space-y-3">
              {[
                { label: "Home", href: "#home" },
                { label: "About", href: "#about" },
                { label: "Events", href: "#events" },
                { label: "Privacy Policy", href: "/privacy.html" },
                { label: "Terms of Service", href: "/terms.html" },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="block text-sm hover:opacity-70 transition-opacity"
                  style={{ color: textWhite }}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-[11px] tracking-[0.25em] uppercase mb-4" style={{ color: textWhiteMuted }}>
              Social
            </h4>
            <div className="space-y-3">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="group/link flex items-center gap-2 text-sm hover:opacity-70 transition-opacity"
                  style={{ color: textWhite }}
                >
                  {link.label}
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" style={{ color: textWhiteMuted }} />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="h-px w-full mb-6" style={{ backgroundColor: borderWhite }} />
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: textWhiteMuted }}>
            © {new Date().getFullYear()} Builders Node. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: textWhiteMuted }}>
            Roatán, Honduras
          </p>
        </div>
      </div>
    </footer>
  </>
  );
};

export default Footer;
