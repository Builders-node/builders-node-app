import { ExternalLink } from "lucide-react";
import { useGsapTitle } from "@/hooks/useGsapTitle";

interface Tweet {
  name: string;
  handle: string;
  avatarUrl: string;
  text: string;
  postImageUrl?: string;
  date: string;
  views: string;
  tweetUrl: string;
}

const tweets: Tweet[] = [
  {
    name: "Jesse",
    handle: "@jesse_pariselli",
    avatarUrl: "https://cdn.prod.website-files.com/6724125117125f2970da4c89/67ec740d6972bae627dfc113_2794e5f20315b35aa1a762836c392feb_pfp%20jesse.webp",
    text: "1/ We've started new currencies. Can we start new countries?\n\n@ProsperaGlobal is the only startup city with legal freedoms—a private, for profit, low-tax jurisdiction built for innovation.\n\nI've been living here as part of @infinitacity pop-up—here's what I've learned 🧵👇",
    date: "Mar 17, 2025",
    views: "62.7K",
    tweetUrl: "https://x.com/jesse_pariselli/status/1901740620302954537",
  },
  {
    name: "Tim Draper",
    handle: "@TimDraper",
    avatarUrl: "https://cdn.prod.website-files.com/6724125117125f2970da4c89/67ec739df664c58a5c1b3dee_pfp%20tim.webp",
    text: "Trip to LATAM. Perspectives: Met with Prospera, Infinita City in Honduras. Prospera is the best place to do business on the planet. The next Dubai. #freedom #bitcoin #lifeextension",
    postImageUrl: "https://cdn.prod.website-files.com/6724125117125f2970da4c89/67ec94977c4cc6267eee7622_post%20img%20tim.webp",
    date: "Mar 12, 2025",
    views: "141.6K",
    tweetUrl: "https://x.com/TimDraper/status/1899841452731252810",
  },
  {
    name: "Anna Vakhrusheva",
    handle: "@anna9vakh",
    avatarUrl: "https://cdn.prod.website-files.com/6724125117125f2970da4c89/67ec73a86972bae627df6214_bc3249d08a68e2ca370ea45c717d82f8_pfp%20anna.webp",
    text: "🏝️ Roatán isn't just a paradise island — it's where biotech dreams come true. Gene therapies over breakfast, startups in swimsuits, billionaires dropping by. A warm, magical second home.",
    postImageUrl: "https://cdn.prod.website-files.com/6724125117125f2970da4c89/67ec9497c9ba5a9c3138dd14_05f0d132ba1f33623fc53900876abb48_post%20img%20anna.webp",
    date: "Mar 29, 2025",
    views: "1,935",
    tweetUrl: "https://x.com/anna9vakh/status/1906215307255095392",
  },
  {
    name: "Brian Armstrong",
    handle: "@brian_armstrong",
    avatarUrl: "https://cdn.prod.website-files.com/6724125117125f2970da4c89/67ec74936972bae627e039e9_pfp%20brian.webp",
    text: "We're excited to invest in @ProsperaGlobal which is creating special economic zones in Honduras\n\nInfinita City Dome Fireside chat with @erickbrimen @NiklasAnzinger",
    postImageUrl: "https://cdn.prod.website-files.com/6724125117125f2970da4c89/67ec9c406a30d21bfc63c633_443f5653f6eabae83c2eb3eb2f4ba051_post%20img%20brian.webp",
    date: "Jan 21, 2025",
    views: "203K",
    tweetUrl: "https://x.com/brian_armstrong/status/1881807446710059020",
  },
  {
    name: "Elliot Roth",
    handle: "@ThatMrE",
    avatarUrl: "https://cdn.prod.website-files.com/6724125117125f2970da4c89/67ec74938a2b935e87d05388_pfp%20elliot.webp",
    text: "Currently building a lab at @infinitacity - I'd love to talk more\n\nI've helped set up a number of labs, including a coworking lab in SF called cellsius.org for 10x cheaper than any other lab in the city.",
    date: "Jan 25, 2025",
    views: "675",
    tweetUrl: "https://x.com/ThatMrE/status/1883210488395542955",
  },
  {
    name: "Balaji",
    handle: "@balajis",
    avatarUrl: "https://cdn.prod.website-files.com/6724125117125f2970da4c89/67ec74f75b6761e35234201c_d56ee727ecd5bb026e1e48e19915c34f_pfp%20balaji.webp",
    text: "I just got back from Infinita City Dome in Próspera. A startup city on the island of Roatán. It's crypto, it's bio, it's robo. And it's not San Francisco.",
    postImageUrl: "https://cdn.prod.website-files.com/6724125117125f2970da4c89/67ec9c40702ffd285b6afd97_post%20img%20balaji.webp",
    date: "Feb 17, 2024",
    views: "573.9K",
    tweetUrl: "https://x.com/balajis/status/1758767186565640429",
  },
  {
    name: "Kyle O'Brien",
    handle: "@RoiStartup",
    avatarUrl: "https://cdn.prod.website-files.com/6724125117125f2970da4c89/67ec74f78a2b935e87d0ac0c_77c53d0ee34ba0cf4dee321edce1550d_pfp%20kyle.webp",
    text: "I encourage anyone interested in the network state subject to go visit yourself. You'll find yourself among a diverse set of builders, philosophers, BTC maxis and longevity enthusiasts.\n\nA big thanks to @NiklasAnzinger & the teams at @infinitacity & @ProsperaGlobal for hosting me!",
    date: "Feb 10, 2025",
    views: "401",
    tweetUrl: "https://x.com/RoiStartup/status/1888913101766164965",
  },
  {
    name: "Erick A. Brimen",
    handle: "@erickbrimen",
    avatarUrl: "https://cdn.prod.website-files.com/6724125117125f2970da4c89/67ec7550068bf36f0019b23e_df0139104eed524dd75241e7b1325007_pfp%20erick.webp",
    text: "The energy and activity at @infinitacity in Próspera Zone are a clear sign we're on the right path. Innovation happens when people come together with a shared purpose—to build something better",
    date: "Feb 7, 2025",
    views: "2,328",
    tweetUrl: "https://x.com/erickbrimen/status/1887999314313527695",
  },
  {
    name: "Naval",
    handle: "@naval",
    avatarUrl: "https://cdn.prod.website-files.com/6724125117125f2970da4c89/67ec7550de8097d2eed0c7ac_8b1677e69bcd6e67205c0631aed538e5_pfp%20dan.webp",
    text: "\"The future is brighter\" hosted by @NiklasAnzinger in Infinita City Dome",
    postImageUrl: "https://cdn.prod.website-files.com/6724125117125f2970da4c89/67ec949732c775f8cf41eb29_post%20img%20dan.webp",
    date: "Feb 9, 2024",
    views: "3,212",
    tweetUrl: "https://x.com/dandv/status/1756014535247282562",
  },
  {
    name: "Zoe",
    handle: "@techno0ptimist",
    avatarUrl: "https://cdn.prod.website-files.com/6724125117125f2970da4c89/67ec75513cafbe4f27a68610_pfp%20zoe.webp",
    text: "Painting with bioluminescent bacteria at @infinitacity 🦠🧫🎨\n\n(Fun fact: the protein expressed by this bacteria originally came from jellyfish 🐠)",
    postImageUrl: "https://cdn.prod.website-files.com/6724125117125f2970da4c89/67ec9497fd496c9166252dae_43f0aa58c6edca9541250a915a1d0f0d_post%20img%20zone.webp",
    date: "Feb 13, 2025",
    views: "1,370",
    tweetUrl: "https://x.com/techno0ptimist/status/1890238791350366344",
  },
  {
    name: "Bryan Johnson",
    handle: "@bryan_johnson",
    avatarUrl: "https://cdn.prod.website-files.com/6724125117125f2970da4c89/67ec75bd913411d70f070b1b_pfp%20bryan.webp",
    text: "Gene therapy in Prospera (Honduras). This is my second time visiting to receive a safe therapy, in a clinical trial, on the frontiers of regenerative medicine.",
    postImageUrl: "https://cdn.prod.website-files.com/6724125117125f2970da4c89/67ec9c40a72c128668f77da7_3dc45f3093de0f840262e26e7c880cd7_post%20img%20bryan.webp",
    date: "Mar 26, 2024",
    views: "4,230",
    tweetUrl: "https://x.com/bryan_johnson/status/1772699172824596792",
  },
  {
    name: "Aubrey de Grey",
    handle: "@aubreydegrey",
    avatarUrl: "https://cdn.prod.website-files.com/6724125117125f2970da4c89/67ec7608a544162563f29ab4_pfp%20aubrey.webp",
    text: "Just home from a PHENOMENAL few days at Prospera on the paradise island of Roatan, Honduras, they're creating something truly world-changing, and there is already a strong focus on regenerative longevity medicine.",
    postImageUrl: "https://cdn.prod.website-files.com/6724125117125f2970da4c89/67ec9c4057b90501890a271b_post%20img%20aubrey.webp",
    date: "Nov 21, 2023",
    views: "19.5K",
    tweetUrl: "https://x.com/aubreydegrey/status/1727006845913755699",
  },
];

const TweetCard = ({ tweet }: { tweet: Tweet }) => (
  <a
    href={tweet.tweetUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="block rounded-sm border p-6 transition-all duration-300 hover:-translate-y-1"
    style={{
      borderColor: "hsl(0 0% 10% / 0.12)",
      backgroundColor: "hsl(30 30% 96%)",
    }}
  >
    <div className="flex items-start gap-3 mb-4">
      <img loading="lazy" decoding="async"
        src={tweet.avatarUrl}
        alt={tweet.name}
        className="w-11 h-11 rounded-full object-cover flex-shrink-0"
        onError={(e) => {
          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(tweet.name)}&background=1a1a1a&color=fff&size=88`;
        }}
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm leading-tight truncate" style={{ color: "hsl(0 0% 10%)" }}>
          {tweet.name}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "hsl(0 0% 45%)" }}>
          {tweet.handle}
        </p>
      </div>
      <ExternalLink className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "hsl(0 0% 10% / 0.25)" }} />
    </div>

    <p
      className="text-[15px] leading-relaxed whitespace-pre-line"
      style={{ color: "hsl(0 0% 10% / 0.8)" }}
    >
      {tweet.text}
    </p>

    {tweet.postImageUrl && (
      <img loading="lazy" decoding="async"
        src={tweet.postImageUrl}
        alt=""
        className="w-full rounded-sm mt-4 object-cover"
        style={{ maxHeight: 220 }}
      />
    )}

    <div
      className="flex items-center gap-2 mt-4 pt-4 text-xs tracking-wide uppercase"
      style={{ color: "hsl(0 0% 45%)", borderTop: "1px solid hsl(0 0% 10% / 0.08)" }}
    >
      <span>{tweet.date}</span>
      <span style={{ color: "hsl(0 0% 10% / 0.2)" }}>·</span>
      <span>{tweet.views} views</span>
    </div>
  </a>
);

const TwitterSection = () => {
  const titleRef = useGsapTitle<HTMLHeadingElement>();

  return (
    <section className="py-24 md:py-32">
      {/* Header */}
      <div className="px-8 md:px-12 mb-16">
        <p className="text-xs tracking-[0.25em] uppercase mb-4" style={{ color: "hsl(0 0% 45%)" }}>
          Community
        </p>
        <h2
          ref={titleRef}
          className="text-4xl md:text-6xl font-light tracking-tight mb-5"
          style={{ color: "hsl(0 0% 10%)" }}
        >
          What People Are Saying
        </h2>
        <p
          className="text-base md:text-lg font-light max-w-lg"
          style={{ color: "hsl(0 0% 45%)" }}
        >
          Voices from founders, investors, and builders who've experienced Próspera and the Builders Node community.
        </p>
      </div>

      {/* Mobile: horizontal slider */}
      <div className="md:hidden flex overflow-x-auto gap-4 snap-x snap-mandatory scrollbar-hide pb-4 pl-8" style={{ scrollPaddingLeft: '2rem' }}>
        {tweets.map((tweet, i) => (
          <div key={i} className="shrink-0 w-[80vw] snap-start">
            <TweetCard tweet={tweet} />
          </div>
        ))}
        <div className="shrink-0 w-4" />
      </div>

      {/* Desktop: masonry grid */}
      <div className="hidden md:block px-8 md:px-12 columns-2 lg:columns-3 gap-5 space-y-5">
        {tweets.map((tweet, i) => (
          <div key={i} className="break-inside-avoid">
            <TweetCard tweet={tweet} />
          </div>
        ))}
      </div>
    </section>
  );
};

export default TwitterSection;
