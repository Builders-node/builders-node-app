import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { useApplyNav, useAccountNav } from "@/lib/applyNav";
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

const navItems = [
  { num: "/01", label: "Home", href: "#home" },
  { num: "/02", label: "About", href: "#about" },
  { num: "/03", label: "Events", href: "#events" },
  { num: "/04", label: "Contact", href: "#contact" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const openApply = useApplyNav();
  const { currentUserId, openAccount, openLogin } = useAccountNav();
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

        <div className="hidden md:flex items-center gap-10">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm hover:opacity-70 transition-opacity tracking-wide"
              style={{ color: textColor }}
            >
              <span className="text-[10px] mr-1" style={{ color: mutedColor }}>{item.num}</span>
              <span className="font-medium">{item.label}</span>
            </a>
          ))}
          <div className="ml-2 flex items-center gap-2">
            <button
              onClick={openApply}
              className="px-5 py-2 text-sm font-semibold tracking-wide rounded-full transition-all duration-300 hover:scale-105"
              style={{
                backgroundColor: "#EA5404",
                color: "hsl(0 0% 100%)",
                boxShadow: "0 6px 20px rgba(234, 84, 4, 0.45)",
              }}
            >
              Apply
            </button>
            <button
              onClick={currentUserId ? openAccount : openLogin}
              className="px-5 py-2 text-sm font-medium tracking-wide rounded-full transition-all duration-300 hover:scale-105 border"
              style={{
                borderColor: scrolled ? "hsl(0 0% 10% / 0.25)" : "hsl(0 0% 100% / 0.55)",
                color: textColor,
                backgroundColor: "transparent",
              }}
            >
              {currentUserId ? "My account" : "Log in"}
            </button>
          </div>
        </div>

        <button className="md:hidden" style={{ color: textColor }} onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Divider line */}
      <div className="mx-8 md:mx-12 h-px" style={{ backgroundColor: "hsl(0 0% 10% / 0.12)" }} />

      {mobileOpen && (
        <>
          {/* Full-screen overlay rendered at top level via portal-like fixed positioning */}
          <div
            className="md:hidden fixed left-0 top-0 w-full h-[100dvh] z-[9999] flex flex-col px-8 pt-24 pb-12"
            style={{ backgroundColor: "hsl(30 30% 93%)" }}
          >
            <button
              className="absolute top-5 right-8"
              style={{ color: "hsl(0 0% 10%)" }}
              onClick={() => setMobileOpen(false)}
            >
              <X size={24} />
            </button>
            <div className="flex flex-col gap-8 mt-8">
              {navItems.map((item) => (
                <a
                  key={item.href}
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
            <div className="mt-auto flex flex-col gap-3">
              <button
                onClick={() => { openApply(); setMobileOpen(false); }}
                className="w-full px-5 py-4 text-sm font-semibold tracking-wide rounded-full"
                style={{ backgroundColor: "#EA5404", color: "hsl(0 0% 100%)" }}
              >
                Apply
              </button>
              <button
                onClick={() => { (currentUserId ? openAccount : openLogin)(); setMobileOpen(false); }}
                className="w-full px-5 py-4 text-sm font-medium tracking-wide rounded-full border"
                style={{ borderColor: "hsl(0 0% 10% / 0.2)", color: "hsl(0 0% 10%)", backgroundColor: "transparent" }}
              >
                {currentUserId ? "My account" : "Log in"}
              </button>
            </div>
          </div>
        </>
      )}

    </nav>
  );
};

export default Navbar;
