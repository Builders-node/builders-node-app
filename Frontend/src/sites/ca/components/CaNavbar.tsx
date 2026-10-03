import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import logo from "@/assets/logo.svg";

const useScrollProgress = () => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const scrollTop = document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      setProgress(scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return progress;
};

// `href` scrolls within this page; `page` leaves it for another route, which
// has to go through the nav context rather than an anchor — an <a href> would
// reload the whole bundle to reach a page React is already holding.
type NavItem = { num: string; label: string; href: string };

const navItems: NavItem[] = [
  { num: "/01", label: "Home", href: "#home" },
  { num: "/02", label: "About", href: "#about" },
  { num: "/03", label: "Events", href: "#events" },
  { num: "/04", label: "Contact", href: "#contact" },
];

const CaNavbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const progress = useScrollProgress();
  const textColor = scrolled ? "hsl(0 0% 10%)" : "hsl(0 0% 100%)";
  const mutedColor = scrolled ? "hsl(0 0% 45%)" : "hsl(0 0% 100% / 0.6)";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
      style={{
        backgroundColor: scrolled ? "hsl(30 30% 93% / 0.85)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(16px)" : "none",
      }}
    >
      {/* Scroll progress bar */}
      <div className="h-1 w-full" style={{ backgroundColor: "hsl(0 0% 10% / 0.06)" }}>
        <div
          className="h-full transition-[width] duration-100 ease-out"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, hsl(8 85% 40%), hsl(20 100% 55%))",
          }}
        />
      </div>

      <div className="flex items-center justify-between px-8 md:px-12 py-4">
        <a href="#home" className="flex items-center" aria-label="Builders Node">
          <img
            src={logo}
            alt="Builders Node"
            className="h-6 md:h-7 w-auto"
            style={{ filter: scrolled ? "none" : "brightness(0) invert(1)" }}
          />
        </a>

        <div className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm hover:opacity-70 transition-opacity tracking-wide"
              style={{ color: textColor }}
            >
              <span className="text-[10px] mr-1" style={{ color: mutedColor }}>{item.num}</span>
              <span className="font-medium">{item.label}</span>
            </a>
          ))}
        </div>

        {/* 44px square: the icon alone was a 24px target, under the minimum a
            thumb can hit reliably. The negative margin keeps the icon itself
            where it was, flush with the page gutter. */}
        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center w-11 h-11 -mr-2.5"
          style={{ color: textColor }}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="ca-mobile-menu"
        >
          {mobileOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
        </button>
      </div>

      {/* Divider line */}
      <div className="mx-8 md:mx-12 h-px" style={{ backgroundColor: "hsl(0 0% 10% / 0.12)" }} />

      {mobileOpen && (
        <>
          {/* Full-screen overlay rendered at top level via portal-like fixed positioning */}
          <div
            id="ca-mobile-menu"
            className="md:hidden fixed left-0 top-0 w-full h-[100dvh] z-[9999] flex flex-col px-8 pt-24 pb-12"
            style={{ backgroundColor: "hsl(30 30% 93%)" }}
          >
            {/* Same 44px target, centred on where the 24px icon always sat. */}
            <button
              type="button"
              className="absolute top-2.5 right-[22px] inline-flex items-center justify-center w-11 h-11"
              style={{ color: "hsl(0 0% 10%)" }}
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X size={24} aria-hidden="true" />
            </button>
            <div className="flex flex-col gap-8 mt-8">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="block text-2xl tracking-wide font-light"
                  style={{ color: "hsl(0 0% 10%)" }}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="text-xs mr-3" style={{ color: "hsl(0 0% 45%)" }}>{item.num}</span>
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </>
      )}

    </nav>
  );
};

export default CaNavbar;
