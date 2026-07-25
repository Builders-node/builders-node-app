import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Animates each character of the target element's text content
 * with a staggered fade-in + upward slide on scroll.
 * React-safe: does NOT restore innerHTML on cleanup.
 */
export const useGsapTitle = <T extends HTMLElement = HTMLElement>() => {
  const ref = useRef<T>(null);
  const hasSplit = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Only split once — never restore innerHTML (that crashes React)
    if (!hasSplit.current) {
      const wrapped = splitTextNodes(el);
      el.innerHTML = wrapped;
      hasSplit.current = true;
    }

    const chars = el.querySelectorAll<HTMLSpanElement>(".gsap-char");

    const ctx = gsap.context(() => {
      gsap.set(chars, { opacity: 0, y: 20 });

      gsap.to(chars, {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.015,
        ease: "power3.out",
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          once: true,
        },
      });
    }, el);

    return () => {
      ctx.revert();
    };
  }, []);

  return ref;
};

function splitTextNodes(el: HTMLElement): string {
  let result = "";
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      const words = text.split(/(\s+)/);
      for (const segment of words) {
        if (/^\s+$/.test(segment)) {
          result += segment;
        } else {
          result += `<span style="display:inline-block;white-space:nowrap">`;
          for (const char of segment) {
            result += `<span class="gsap-char" style="display:inline-block">${char}</span>`;
          }
          result += `</span>`;
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const child = node as HTMLElement;
      const tag = child.tagName.toLowerCase();
      if (tag === "br") {
        result += "<br/>";
      } else {
        const attrs = Array.from(child.attributes)
          .map((a) => `${a.name}="${a.value}"`)
          .join(" ");
        result += `<${tag}${attrs ? " " + attrs : ""}>${splitTextNodes(child)}</${tag}>`;
      }
    }
  });
  return result;
}
