import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Animates each character of the target element's text content
 * with a staggered fade-in + upward slide on scroll.
 * React-safe: does NOT restore innerHTML on cleanup.
 *
 * Skipped entirely under `prefers-reduced-motion`: the heading is left as
 * React rendered it, unsplit and visible. Splitting first and only skipping
 * the tween would still leave a screen reader spelling it letter by letter.
 *
 * When it does split, the heading carries its full text as an aria-label and
 * the character spans are aria-hidden — otherwise assistive tech reads one
 * span per letter ("C, o, m, e…").
 */
/**
 * @param ready pass false while the heading's text is still being fetched.
 *   The split happens once and can never be redone (restoring innerHTML
 *   crashes React), so a title holding a value that arrives late would freeze
 *   on whatever placeholder was rendered first. Defaults to true for the
 *   headings whose text is a constant.
 */
export const useGsapTitle = <T extends HTMLElement = HTMLElement>(ready = true) => {
  const ref = useRef<T>(null);
  const hasSplit = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    // Also covers the first pass for a not-yet-rendered heading: the effect
    // re-runs when `ready` flips and the element exists.
    if (!el || !ready) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    // Only split once — never restore innerHTML (that crashes React)
    if (!hasSplit.current) {
      const label = (el.textContent || "").replace(/\s+/g, " ").trim();
      const wrapped = splitTextNodes(el);
      el.innerHTML = wrapped;
      if (label) el.setAttribute("aria-label", label);
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
  }, [ready]);

  return ref;
};

/**
 * Text goes back in through innerHTML, so it is escaped on the way: a heading
 * built from fetched data (a price, a name) must not be able to inject markup.
 */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

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
          result += `<span aria-hidden="true" style="display:inline-block;white-space:nowrap">`;
          for (const char of segment) {
            result += `<span class="gsap-char" aria-hidden="true" style="display:inline-block">${escapeHtml(char)}</span>`;
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
          .map((a) => `${a.name}="${escapeHtml(a.value)}"`)
          .join(" ");
        result += `<${tag}${attrs ? " " + attrs : ""}>${splitTextNodes(child)}</${tag}>`;
      }
    }
  });
  return result;
}
