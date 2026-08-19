import { Send } from "lucide-react";

/**
 * The community chat. Kept in one place because it is the only thing on the
 * landing page that points at Telegram, and a wrong handle here is a visitor
 * dropped into somebody else's group.
 */
const TELEGRAM_COMMUNITY_URL = "https://t.me/buildersnodecom";

/**
 * Floating link to the Telegram community.
 *
 * Fixed rather than parked in a section: the pitch it makes — meet the people,
 * see the place — is the answer to a question a visitor has anywhere on the
 * page, not only wherever a section about it happens to sit.
 *
 * The subtitle is desktop-only. On a phone the same two lines would take a
 * quarter of the screen and sit on top of whatever the visitor came to read, so
 * there it collapses to the name and the glyph.
 */
const TelegramCommunityButton = () => {
  return (
    <a
      href={TELEGRAM_COMMUNITY_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Telegram Community — meet the founders and participants, and see what daily life in Próspera actually looks like"
      className="group fixed bottom-5 right-5 z-50 flex max-w-[calc(100vw-2.5rem)] items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl transition-transform duration-200 hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:max-w-sm sm:items-start sm:gap-3.5 sm:px-5 sm:py-4"
      style={{ backgroundColor: "hsl(0 0% 10%)", color: "hsl(0 0% 100%)" }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: "#229ED9" }}
        aria-hidden="true"
      >
        <Send size={17} className="-ml-px" />
      </span>

      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-semibold leading-tight tracking-tight">
          Telegram Community
        </span>
        <span
          className="hidden text-xs leading-snug sm:block"
          style={{ color: "hsl(0 0% 72%)" }}
        >
          Meet the founders and participants, and see what daily life in Próspera actually looks like
        </span>
      </span>
    </a>
  );
};

export default TelegramCommunityButton;
