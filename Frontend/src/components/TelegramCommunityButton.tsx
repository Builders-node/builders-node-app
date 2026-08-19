import { Send } from "lucide-react";

/**
 * The community chat. Kept in one place because it is the only thing on the
 * landing page that points at Telegram, and a wrong handle here is a visitor
 * dropped into somebody else's group.
 */
const TELEGRAM_COMMUNITY_URL = "https://t.me/buildersnodecom";

/** Telegram's own blue, so the button is recognisable before it is read. */
const TELEGRAM_BLUE = "#229ED9";

/**
 * Floating link to the Telegram community.
 *
 * Fixed rather than parked in a section: "who is actually there, and what is it
 * like" is a question a visitor has anywhere on the page, not only wherever a
 * section about it happens to sit.
 */
const TelegramCommunityButton = () => {
  return (
    <a
      href={TELEGRAM_COMMUNITY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-50 flex max-w-[calc(100vw-2.5rem)] items-center gap-2.5 rounded-full py-3 pl-4 pr-5 text-sm font-semibold leading-none tracking-tight shadow-2xl transition-transform duration-200 hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
      style={{ backgroundColor: TELEGRAM_BLUE, color: "#fff" }}
    >
      <Send size={17} className="-ml-px shrink-0" aria-hidden="true" />
      Telegram Community
    </a>
  );
};

export default TelegramCommunityButton;
