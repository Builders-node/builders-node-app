import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Globe, Link2, Loader2, Mail, MessageCircle, Send, User, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { storedCampaignCode } from "@/lib/campaign";

interface AffiliateFormProps {
  onSuccess?: () => void;
}

const MAX_ABOUT = 1000;

/**
 * The affiliate application.
 *
 * Deliberately much shorter than the member one. We are not deciding whether
 * someone can live here — only whether their audience is real and whether the
 * way they would talk about Builders Node is one we want our name on. Anything
 * beyond that is a question for the reply, and every extra required field on a
 * public form is somebody deciding not to bother.
 *
 * No email-confirmation step either, unlike the member form. That exists there
 * because an application creates an account; here it creates a row an admin
 * reads, and an unverified address costs us one wasted read rather than a
 * half-built account nobody can sign into.
 *
 * Note what this form is *not*: it does not hand out the referral link. Every
 * account carries a code already, so the link comes with registering. This is
 * how the team learns whose audience it is and where to send the money.
 */
const AffiliateForm = ({ onSuccess }: AffiliateFormProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [telegram, setTelegram] = useState("");
  const [country, setCountry] = useState("");
  const [audience, setAudience] = useState("");
  const [audienceSize, setAudienceSize] = useState("");
  const [link1, setLink1] = useState("");
  const [link2, setLink2] = useState("");
  const [about, setAbout] = useState("");
  /**
   * Read once, at mount. Never shown and never editable: it credits the channel
   * we posted the affiliate page on, which belongs to the traffic report rather
   * than to the person filling this in.
   */
  const [campaignCode] = useState(storedCampaignCode);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!fullName.trim() || !email.trim() || !audience.trim()) {
      toast({
        title: "Missing fields",
        description: "We need your name, your email, and where you'd promote.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest("/public/affiliates/apply", {
        method: "POST",
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          telegram: telegram.trim() || undefined,
          country: country.trim() || undefined,
          audience: audience.trim(),
          audienceSize: audienceSize.trim() || undefined,
          links: [link1, link2].map((link) => link.trim()).filter(Boolean),
          about: about.trim() || undefined,
          campaignCode: campaignCode || undefined,
        }),
      });

      // One conversion event per submitted application, same as the member form.
      try {
        (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag?.("event", "generate_lead", {
          lead_type: "affiliate_application",
        });
        (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq?.("track", "Lead");
      } catch {
        /* tracking is never worth failing a submission over */
      }

      onSuccess?.();
    } catch (error) {
      toast({
        title: "Could not send that",
        description: error instanceof Error ? error.message : "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass = "pl-10 border-0 bg-white shadow-sm focus-visible:ring-1";
  const fieldStyle = { color: "hsl(0 0% 10%)" };
  const iconClass = "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4";
  const iconStyle = { color: "hsl(0 0% 45%)" };

  return (
    <div className="w-full" style={{ color: "hsl(0 0% 10%)" }}>
      <form className="space-y-7" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="aff-name" className="text-sm font-medium">
              Full name <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <User className={iconClass} style={iconStyle} />
              <Input
                id="aff-name"
                type="text"
                placeholder="Satoshi Nakamoto"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={fieldClass}
                style={fieldStyle}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="aff-email" className="text-sm font-medium">
              Email <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Mail className={iconClass} style={iconStyle} />
              <Input
                id="aff-email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldClass}
                style={fieldStyle}
              />
            </div>
            <p className="text-xs" style={{ color: "hsl(0 0% 45%)" }}>
              Use the same address as your Builders Node account, so we can match the two.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="aff-telegram" className="text-sm font-medium">
              Telegram
            </Label>
            <div className="relative">
              <MessageCircle className={iconClass} style={iconStyle} />
              <Input
                id="aff-telegram"
                type="text"
                placeholder="@yourhandle"
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                className={fieldClass}
                style={fieldStyle}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="aff-country" className="text-sm font-medium">
              Where you&apos;re based
            </Label>
            <div className="relative">
              <Globe className={iconClass} style={iconStyle} />
              <Input
                id="aff-country"
                type="text"
                placeholder="Lisbon, Portugal"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={fieldClass}
                style={fieldStyle}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="aff-audience" className="text-sm font-medium">
              Where would you promote? <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Send className={iconClass} style={iconStyle} />
              <Input
                id="aff-audience"
                type="text"
                placeholder="YouTube — startup interviews"
                required
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className={fieldClass}
                style={fieldStyle}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="aff-size" className="text-sm font-medium">
              How big is your audience?
            </Label>
            <div className="relative">
              <Users className={iconClass} style={iconStyle} />
              {/* Free text, not a number. "12k on X, ~3k newsletter" is the
                  honest answer, and a single integer field would make people
                  throw half of it away. */}
              <Input
                id="aff-size"
                type="text"
                placeholder="12k on X, ~3k newsletter"
                value={audienceSize}
                onChange={(e) => setAudienceSize(e.target.value)}
                className={fieldClass}
                style={fieldStyle}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="aff-link1" className="text-sm font-medium">
              Your channel
            </Label>
            <div className="relative">
              <Link2 className={iconClass} style={iconStyle} />
              <Input
                id="aff-link1"
                type="url"
                inputMode="url"
                placeholder="https://youtube.com/@you"
                value={link1}
                onChange={(e) => setLink1(e.target.value)}
                className={fieldClass}
                style={fieldStyle}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="aff-link2" className="text-sm font-medium">
              Another channel
            </Label>
            <div className="relative">
              <Link2 className={iconClass} style={iconStyle} />
              <Input
                id="aff-link2"
                type="url"
                inputMode="url"
                placeholder="https://x.com/you"
                value={link2}
                onChange={(e) => setLink2(e.target.value)}
                className={fieldClass}
                style={fieldStyle}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="aff-about" className="text-sm font-medium">
            How would you introduce Builders Node to them?
          </Label>
          <Textarea
            id="aff-about"
            rows={5}
            maxLength={MAX_ABOUT}
            placeholder="A short post, a video segment, a mention in my newsletter — whatever you'd actually do."
            value={about}
            onChange={(e) => setAbout(e.target.value.slice(0, MAX_ABOUT))}
            className="border-0 bg-white shadow-sm focus-visible:ring-1 resize-none"
            style={fieldStyle}
          />
          <p className="text-xs text-right" style={{ color: "hsl(0 0% 45%)" }}>
            {about.length}/{MAX_ABOUT}
          </p>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 text-sm tracking-[0.15em] uppercase font-medium rounded-lg"
          style={{ backgroundColor: "hsl(0 0% 10%)", color: "hsl(30 30% 93%)" }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            "Send this to the team"
          )}
        </Button>

        <p className="text-xs text-center" style={{ color: "hsl(0 0% 45%)" }}>
          A person reads every one of these. You&apos;ll hear back either way.
        </p>
      </form>
    </div>
  );
};

export default AffiliateForm;
