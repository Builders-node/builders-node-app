/** Also preloaded from index.html, so it can paint before any script runs. */
export const HERO_POSTER = "/media/hero-poster.jpg";

/**
 * Whether the background loop should play at all.
 *
 * Not with Data Saver on — the visitor has asked for exactly this kind of
 * download to be skipped, and the poster says the same thing for free. Not
 * with reduced motion either: a full-screen moving background is the motion
 * that setting is about. Read once at render; neither changes mid-visit often
 * enough to be worth listening for.
 */
function wantsVideo(): boolean {
  if (typeof window === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return false;
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The landing heroes' background: the poster, and the video over it.
 *
 * Shared by the main landing and the CA site, which used the same markup.
 *
 *  - AV1 first. A browser plays the first <source> it supports, and every
 *    browser supports H.264 — so with it listed first nobody ever got the AV1
 *    encode, which is the one meant to be lighter. Browsers without AV1
 *    (most iPhones among them) skip it and fall through to H.264.
 *  - preload="metadata". `autoPlay` starts the download anyway; "auto" only
 *    told the browser it may fetch the whole file ahead of need, competing
 *    with the page's own scripts and fonts on a phone connection.
 */
export function HeroVideo() {
  return (
    <>
      {/* Poster as a background too: shown until the video plays, when it
          can't, and on its own when the video is skipped. */}
      <div
        className="absolute inset-0 w-full h-full bg-black bg-cover bg-center"
        style={{ backgroundImage: `url('${HERO_POSTER}')` }}
      />

      {wantsVideo() ? (
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={HERO_POSTER}
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source
            src="https://v20uliacxvh3bj6g.public.blob.vercel-storage.com/hero_web_av1-6GILWV8N0A8yXV3Nb9Tlv9DYjItjnW.mp4"
            type="video/mp4; codecs=av01.0.05M.08"
          />
          <source src="/media/hero.mp4" type="video/mp4; codecs=avc1.42E01E" />
        </video>
      ) : null}
    </>
  );
}
