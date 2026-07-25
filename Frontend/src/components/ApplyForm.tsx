import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Mail, User, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { useBatch } from "@/lib/batch";

interface ApplyFormProps {
  onClose?: () => void;
  onSuccess?: () => void;
  initialEmail?: string;
  initialFullName?: string;
}

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz3W2M-aHf3pNfxLF0_vnyVPSe4copxmHlm9RVHrUiQqeT3UNDukUDg6A9-crO9Gdgn/exec";

const stayDurations = Array.from({ length: 12 }, (_, i) => `${i + 1} month${i > 0 ? "s" : ""}`);

const tshirtSizes = ["XS", "S", "M", "L", "XL", "XXL"];

const referralSources = [
  "Twitter / X",
  "Instagram",
  "LinkedIn",
  "YouTube",
  "Friend or referral",
  "Podcast",
  "Google search",
  "Próspera event",
  "Other",
];

const ApplyForm = ({ onClose, onSuccess, initialEmail, initialFullName }: ApplyFormProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState(initialEmail ?? "");
  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [visitDate, setVisitDate] = useState("");
  const [stayDuration, setStayDuration] = useState("");
  const [gender, setGender] = useState("male");
  const [plan, setPlan] = useState("private");
  const [tshirtSize, setTshirtSize] = useState("");
  const [social1, setSocial1] = useState("");
  const [social2, setSocial2] = useState("");
  const [aboutText, setAboutText] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const maxChars = 1000;

  const batch = useBatch();

  const visitOptions = useMemo(() => {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    // Batch start from admin settings, falling back to September 1, 2026.
    const firstArrival = batch.date ?? new Date(2026, 8, 1);
    const start = nextMonth > firstArrival ? nextMonth : firstArrival;
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      return {
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`,
        label: d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch.startDate]);

  const isOneMonth = stayDuration === "1 month";
  const privatePrice = isOneMonth ? 2450 : 1950;
  const sharedPrice = isOneMonth ? 3450 : 2950;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !fullName || !visitDate || !stayDuration || !aboutText) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    const selectedVisit = visitOptions.find((o) => o.value === visitDate);
    const minDate = new Date(visitOptions[0].value);
    if (!selectedVisit || new Date(visitDate) < minDate) {
      toast({ title: "Invalid date", description: "Please pick a date starting next month.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    const visitLabel = visitOptions.find((o) => o.value === visitDate)?.label ?? visitDate;
    const planLabel =
      plan === "shared"
        ? `Couple option (2 people) - $${sharedPrice.toLocaleString()}/month`
        : `Private room - $${privatePrice.toLocaleString()}/month`;
    const note = [
      `Move-in: ${visitLabel}`,
      `Stay: ${stayDuration}`,
      `Plan: ${planLabel}`,
      gender ? `Gender: ${gender}` : "",
      tshirtSize ? `T-shirt: ${tshirtSize}` : "",
      social1 ? `Social 1: ${social1}` : "",
      social2 ? `Social 2: ${social2}` : "",
      referralSource ? `Heard via: ${referralSource}` : "",
      aboutText ? `\nAbout:\n${aboutText}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      // Primary: register the application in our backend so it enters the admin
      // Applicants funnel.
      await apiRequest("/applications", {
        method: "POST",
        body: JSON.stringify({
          fullName,
          email,
          note,
          referralCode: referralCode || undefined,
        }),
      });

      // Best-effort mirror to the Google Sheet (never blocks submission).
      fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          fullName,
          visitDate: visitLabel,
          stayDuration,
          gender,
          plan: planLabel,
          tshirtSize,
          social1,
          social2,
          about: aboutText,
          referralSource,
          referralCode,
        }),
      }).catch(() => {
        /* mirror is optional */
      });

      // Fire conversion tracking once per successful submission
      try {
        (window as any).gtag?.("event", "generate_lead", {
          lead_type: "completed_application",
        });
        (window as any).fbq?.("track", "Lead");
      } catch (trackingError) {
        console.error("Tracking error:", trackingError);
      }

      toast({ title: "Application sent!", description: "We'll get back to you soon." });
      // Reset form
      setEmail("");
      setFullName("");
      setVisitDate("");
      setStayDuration("");
      setGender("male");
      setPlan("private");
      setTshirtSize("");
      setSocial1("");
      setSocial2("");
      setAboutText("");
      setReferralSource("");
      setReferralCode("");
      onSuccess?.();
    } catch (error) {
      console.error("Submission error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full" style={{ color: "hsl(0 0% 10%)" }}>
        <form className="space-y-8" onSubmit={handleSubmit}>
          {/* Email & Full Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium" style={{ color: "hsl(0 0% 10%)" }}>
                Email <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "hsl(0 0% 45%)" }} />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 border-0 bg-white shadow-sm focus-visible:ring-1"
                  style={{ borderColor: "hsl(0 0% 80%)", color: "hsl(0 0% 10%)" }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullname" className="text-sm font-medium" style={{ color: "hsl(0 0% 10%)" }}>
                Full name <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "hsl(0 0% 45%)" }} />
                <Input
                  id="fullname"
                  type="text"
                  placeholder="Satoshi Nakamoto"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10 border-0 bg-white shadow-sm focus-visible:ring-1"
                  style={{ borderColor: "hsl(0 0% 80%)", color: "hsl(0 0% 10%)" }}
                />
              </div>
            </div>
          </div>

          {/* When can you visit */}
          <div className="space-y-2">
            <Label className="text-sm font-medium" style={{ color: "hsl(0 0% 10%)" }}>
              When can you visit? <span className="text-red-500">*</span>
            </Label>
            <Select value={visitDate} onValueChange={setVisitDate}>
              <SelectTrigger className="border-0 bg-white shadow-sm" style={{ borderColor: "hsl(0 0% 80%)", color: "hsl(0 0% 10%)" }}>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {visitOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs" style={{ color: "hsl(0 0% 45%)" }}>
              First arrivals start September 1, 2026. Memberships begin on the first of each month.
            </p>
          </div>

          {/* How long */}
          <div className="space-y-2">
            <Label className="text-sm font-medium" style={{ color: "hsl(0 0% 10%)" }}>
              How long do you want to stay? <span className="text-red-500">*</span>
            </Label>
            <Select value={stayDuration} onValueChange={setStayDuration}>
              <SelectTrigger className="border-0 bg-white shadow-sm" style={{ borderColor: "hsl(0 0% 80%)", color: "hsl(0 0% 10%)" }}>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {stayDurations.map((dur) => (
                  <SelectItem key={dur} value={dur}>{dur}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Gender */}
          <div className="space-y-3">
            <Label className="text-sm font-medium" style={{ color: "hsl(0 0% 10%)" }}>
              Gender <span className="text-red-500">*</span>
            </Label>
            <RadioGroup value={gender} onValueChange={setGender} className="flex gap-6">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="male" id="male" />
                <Label htmlFor="male" className="cursor-pointer" style={{ color: "hsl(0 0% 10%)" }}>Male</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="female" id="female" />
                <Label htmlFor="female" className="cursor-pointer" style={{ color: "hsl(0 0% 10%)" }}>Female</Label>
              </div>
            </RadioGroup>
          </div>

          {/* T-shirt size */}
          <div className="space-y-2">
            <Label className="text-sm font-medium" style={{ color: "hsl(0 0% 10%)" }}>
              T-shirt size
            </Label>
            <Select value={tshirtSize} onValueChange={setTshirtSize}>
              <SelectTrigger className="border-0 bg-white shadow-sm" style={{ borderColor: "hsl(0 0% 80%)", color: "hsl(0 0% 10%)" }}>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {tshirtSizes.map((size) => (
                  <SelectItem key={size} value={size}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Room info */}
          <div className="space-y-3">
            <Label className="text-sm font-medium" style={{ color: "hsl(0 0% 10%)" }}>
              Membership plan <span className="text-red-500">*</span>
            </Label>
            <RadioGroup value={plan} onValueChange={setPlan} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                htmlFor="plan-private"
                className={`rounded-lg p-4 bg-white cursor-pointer border transition-colors ${plan === "private" ? "border-black" : "border-transparent"}`}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="private" id="plan-private" className="mt-1" />
                  <div>
                    <p className="text-lg font-medium" style={{ color: "hsl(0 0% 10%)" }}>${privatePrice.toLocaleString()}/month</p>
                    <p className="text-xs mt-1" style={{ color: "hsl(0 0% 35%)" }}>Private room · 1 person</p>
                    <p className="text-xs mt-1" style={{ color: "hsl(0 0% 35%)" }}>Meals · Gym · Coworking · Sports · Community</p>
                  </div>
                </div>
              </label>
              <label
                htmlFor="plan-shared"
                className={`rounded-lg p-4 bg-white cursor-pointer border transition-colors ${plan === "shared" ? "border-black" : "border-transparent"}`}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="shared" id="plan-shared" className="mt-1" />
                  <div>
                    <p className="text-lg font-medium" style={{ color: "hsl(0 0% 10%)" }}>${sharedPrice.toLocaleString()}/month</p>
                    <p className="text-xs mt-1" style={{ color: "hsl(0 0% 35%)" }}>Couple option · 2 people</p>
                    <p className="text-xs mt-1" style={{ color: "hsl(0 0% 35%)" }}>Meals · Gym · Coworking · Sports · Community</p>
                  </div>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Social links */}
          <div className="space-y-3">
            <Label className="text-sm font-medium" style={{ color: "hsl(0 0% 10%)" }}>
              Please link your socials
            </Label>
            <p className="text-xs" style={{ color: "hsl(0 0% 45%)" }}>Provide at least two links.</p>
            <div className="space-y-3">
              <Input
                type="url"
                placeholder="https://twitter.com/..."
                value={social1}
                onChange={(e) => setSocial1(e.target.value)}
                className="border-0 bg-white shadow-sm focus-visible:ring-1"
                style={{ borderColor: "hsl(0 0% 80%)", color: "hsl(0 0% 10%)" }}
              />
              <Input
                type="url"
                placeholder="https://linkedin.com/in/..."
                value={social2}
                onChange={(e) => setSocial2(e.target.value)}
                className="border-0 bg-white shadow-sm focus-visible:ring-1"
                style={{ borderColor: "hsl(0 0% 80%)", color: "hsl(0 0% 10%)" }}
              />
            </div>
          </div>

          {/* How did you hear about us */}
          <div className="space-y-2">
            <Label className="text-sm font-medium" style={{ color: "hsl(0 0% 10%)" }}>
              How did you hear about us?
            </Label>
            <Select value={referralSource} onValueChange={setReferralSource}>
              <SelectTrigger className="border-0 bg-white shadow-sm" style={{ borderColor: "hsl(0 0% 80%)", color: "hsl(0 0% 10%)" }}>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {referralSources.map((src) => (
                  <SelectItem key={src} value={src}>{src}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Referral Code */}
          <div className="space-y-2">
            <Label htmlFor="referral-code" className="text-sm font-medium" style={{ color: "hsl(0 0% 10%)" }}>
              Referral code
            </Label>
            <Input
              id="referral-code"
              type="text"
              placeholder="Optional"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              className="border-0 bg-white shadow-sm focus-visible:ring-1"
              style={{ borderColor: "hsl(0 0% 80%)", color: "hsl(0 0% 10%)" }}
            />
          </div>


          {/* Tell us about yourself */}
          <div className="space-y-2">
            <Label className="text-sm font-medium" style={{ color: "hsl(0 0% 10%)" }}>
              Tell us about yourself <span className="text-red-500">*</span>
            </Label>
            <Textarea
              placeholder="Tell us about yourself, your background, and what you're working on..."
              required
              maxLength={maxChars}
              value={aboutText}
              onChange={(e) => setAboutText(e.target.value)}
              className="min-h-[120px] border-0 bg-white shadow-sm focus-visible:ring-1 resize-none"
              style={{ borderColor: "hsl(0 0% 80%)", color: "hsl(0 0% 10%)" }}
            />
            <p className="text-xs text-right" style={{ color: "hsl(0 0% 45%)" }}>
              {maxChars - aboutText.length} characters left
            </p>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 text-sm tracking-[0.15em] uppercase font-medium rounded-lg"
            style={{ backgroundColor: "hsl(0 0% 10%)", color: "hsl(30 30% 93%)" }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Application"
            )}
          </Button>
        </form>
    </div>
  );
};

export default ApplyForm;
