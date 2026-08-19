import { Send } from "lucide-react";
import { TELEGRAM_BLUE, TELEGRAM_COMMUNITY_URL } from "@/lib/telegram";

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
