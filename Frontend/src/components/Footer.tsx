import { useAccountNav, useApplyNav } from "@/lib/applyNav";
import { Mail, ArrowUpRight } from "lucide-react";
import logo from "@/assets/logo.svg";

const textWhite = "hsl(0 0% 100%)";
const textWhiteMuted = "hsl(0 0% 100% / 0.6)";
const borderWhite = "hsl(0 0% 100% / 0.2)";

/**
 * `https://wa.me/<number>` once there is a number to chat on. Until then the
 * WhatsApp button stays hidden rather than leading nowhere.
 */
const WHATSAPP_URL = "";
const CONTACT_EMAIL = "hello@buildersnode.com";

const socialLinks = [
  { label: "X / Twitter", href: "#" },
  { label: "Instagram", href: "https://instagram.com/buildersnode" },
  { label: "Discord", href: "https://discord.gg/Aa4jqe4dth" },
];

type FooterProps = {
  /** `false` on pages without an events section, so the link isn't dead. */
  showEvents?: boolean;
  /**
   * The main landing's ask: "Come build with us." with Apply, WhatsApp and
   * the contact address, in place of the "Let's talk" line.
   */
  comeBuild?: boolean;
};

const Footer = ({ showEvents = true, comeBuild = false }: FooterProps = {}) => {
  const openApply = useApplyNav();
  const { openAffiliate } = useAccountNav();

  return (
    <>
    <footer
      id="contact"
      className="px-8 md:px-12 pt-20 pb-12"
      style={{ background: "linear-gradient(135deg, hsl(16 90% 45%), hsl(25 100% 50%))" }}
    >
      <div>
        {/* Big CTA */}
        {comeBuild ? (
          <div className="mb-20">
            <h2
              className="text-5xl md:text-7xl lg:text-8xl font-light tracking-tight leading-[1.05] max-w-3xl"
              style={{ color: textWhite }}
            >
              Come build with us.
            </h2>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={openApply}
                className="text-xs tracking-[0.25em] uppercase font-semibold rounded-full px-7 py-3.5 transition-all duration-300 hover:scale-105 cursor-pointer border-none"
                style={{ backgroundColor: "hsl(0 0% 10%)", color: textWhite }}
              >
                Apply
              </button>
              {WHATSAPP_URL ? (
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs tracking-[0.25em] uppercase font-semibold rounded-full px-7 py-3.5 border transition-all duration-300 hover:scale-105 hover:bg-white/10"
                  style={{ color: textWhite, borderColor: "hsl(0 0% 100% / 0.7)" }}
                >
                  Chat on WhatsApp
                </a>
              ) : null}
            </div>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-block mt-8 text-sm font-medium border-b pb-1 transition-opacity hover:opacity-80"
              style={{ color: textWhite, borderColor: "hsl(0 0% 100% / 0.7)" }}
            >
              {CONTACT_EMAIL}
            </a>
          </div>
        ) : (
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
        )}

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
                ...(showEvents ? [{ label: "Events", href: "#events" }] : []),
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
              {/* A button, not an anchor: the affiliate page is another route,
                  and an href would reload the bundle to reach it. */}
              <button
                type="button"
                onClick={openAffiliate}
                className="block text-sm hover:opacity-70 transition-opacity text-left"
                style={{ color: textWhite, background: "none", border: "none", padding: 0, cursor: "pointer" }}
              >
                Affiliate programme
              </button>
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
