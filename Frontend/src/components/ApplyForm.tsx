import { useEffect, useMemo, useState } from "react";
import { useMembershipPlans, type MembershipPlanOption } from "@/lib/membership-plans";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Mail, User, Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { useBatch } from "@/lib/batch";
import { clearStoredReferral, storedReferralCode } from "@/lib/referral";

interface ApplyFormProps {
  onClose?: () => void;
  onSuccess?: () => void;
  onAuthenticated?: (session: { accessToken: string; user: { id: string; role: string } }) => void;
  initialEmail?: string;
  initialFullName?: string;
}

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz3W2M-aHf3pNfxLF0_vnyVPSe4copxmHlm9RVHrUiQqeT3UNDukUDg6A9-crO9Gdgn/exec";

const stayDurations = ["1 month", "3 months", "6 months", "12 months"];

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
  "Infinita City",
  "Other",
];

const ApplyForm = ({ onClose, onSuccess, onAuthenticated, initialEmail, initialFullName }: ApplyFormProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState(initialEmail ?? "");
  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [visitDate, setVisitDate] = useState("");
  const [stayDuration, setStayDuration] = useState("");
  const [gender, setGender] = useState("male");
  // Holds a plan id once the catalogue loads; empty until then.
  const [plan, setPlan] = useState("");
  const [tshirtSize, setTshirtSize] = useState("");
  const [social1, setSocial1] = useState("");
  const [social2, setSocial2] = useState("");
  const [aboutText, setAboutText] = useState("");
  const [referralSource, setReferralSource] = useState("");
  // Prefilled from the invite link they arrived on, still editable — someone
  // who was told a code by hand can type it over the top.
  const [referralCode, setReferralCode] = useState(storedReferralCode);
  const [arrivedWithReferral] = useState(() => Boolean(storedReferralCode()));
  const maxChars = 1000;

  // Flow: form → confirm emailed 6-digit code → (set password if no account) → success.
  const [step, setStep] = useState<"form" | "code" | "password">("form");
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  // The account these came from is fetched after this form has already mounted,
  // so useState's initial value misses them and the fields sit empty. That's
  // worse than cosmetic: an application filed under a different address never
  // links back to the account, so a member (or an admin) applying about
  // themselves would end up with an orphan. Only fills a field nobody has typed
  // into yet — the address stays theirs to change.
  useEffect(() => {
    if (initialEmail) setEmail((current) => current || initialEmail);
  }, [initialEmail]);
  useEffect(() => {
    if (initialFullName) setFullName((current) => current || initialFullName);
  }, [initialFullName]);

  const batch = useBatch();

  const visitOptions = useMemo(() => {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    // Batch start from admin settings (useBatch supplies its own fallback).
    const firstArrival = batch.date;
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
  // Priced by the admin, not by this file. These two lines used to be the only
  // place Builders Node's price existed, so changing it meant a code deploy.
  const { plans, isLoading: plansLoading } = useMembershipPlans();
  const selectedPlan = plans.find((option) => option.id === plan) ?? plans[0] ?? null;
  const priceOf = (option: MembershipPlanOption) =>
    (isOneMonth ? option.shortStayPriceCents : option.priceCents) / 100;

  const visitLabel = visitOptions.find((o) => o.value === visitDate)?.label ?? visitDate;
  const planLabel = selectedPlan
    ? `${selectedPlan.name} - $${priceOf(selectedPlan).toLocaleString()}/month`
    : "";

  const buildNote = () =>
    [
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

  const requestCode = async () => {
    await apiRequest("/applications/request-code", {
      method: "POST",
      body: JSON.stringify({
        fullName,
        email,
        // `note` stays the readable summary admins scan in the Inbox. `about`
        // and `socials` go alongside it as real fields, because they seed the
        // member's profile once the account exists — parsing them back out of
        // the note blob would have been guesswork.
        note: buildNote(),
        about: aboutText,
        // Same answer as the "Move-in" line in the note, but as a real date —
        // meal deliveries get scheduled from it, and re-parsing "January 1,
        // 2027" back out of prose is no way to decide when food starts.
        moveInDate: visitDate || undefined,
        socials: [social1, social2].filter(Boolean),
        referralCode: referralCode || undefined,
      }),
    });
  };

  const resetForm = () => {
    setEmail("");
    setFullName("");
    setVisitDate("");
    setStayDuration("");
    setGender("male");
    setPlan("");
    setTshirtSize("");
    setSocial1("");
    setSocial2("");
    setAboutText("");
    setReferralSource("");
    setReferralCode("");
    setCode("");
    setPassword("");
    setConfirmPassword("");
    setStep("form");
  };

  // Step 1: validate, then email a confirmation code and move to the code step.
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
    try {
      await requestCode();
      setCode("");
      setStep("code");
      toast({ title: "Check your email", description: `We sent a 6-digit code to ${email}.` });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Could not send the code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: confirm the emailed code; the application is created server-side here.
  const verifyCode = async () => {
    if (code.length !== 6) {
      toast({ title: "Enter the 6-digit code", description: "Check your email for the confirmation code.", variant: "destructive" });
      return;
    }
    setIsVerifying(true);
    try {
      const result = await apiRequest<{ accountExists: boolean }>("/applications/confirm", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });

      // Best-effort mirror to the Google Sheet (never blocks; only on confirmed apps).
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

      // Fire conversion tracking once per confirmed application.
      try {
        (window as any).gtag?.("event", "generate_lead", { lead_type: "completed_application" });
        (window as any).fbq?.("track", "Lead");
      } catch (trackingError) {
        console.error("Tracking error:", trackingError);
      }

      // The application exists now, so the invite has done its job. Forget the
      // code — the next person to apply on this browser isn't their recruit.
      clearStoredReferral();

      if (result.accountExists) {
        // Already has a login — nothing to set up, go straight to success.
        resetForm();
        onSuccess?.();
      } else {
        // No account yet — have them set a password to finish.
        setStep("password");
      }
    } catch (error) {
      toast({
        title: "Wrong code",
        description: error instanceof Error ? error.message : "That code is not correct. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Step 3: set a password → create the account, sign in, then show success.
  const createAccount = async () => {
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please re-enter the same password.", variant: "destructive" });
      return;
    }
    setIsCreatingAccount(true);
    try {
      const session = await apiRequest<{ accessToken: string; user: { id: string; role: string } }>(
        "/applications/create-account",
        { method: "POST", body: JSON.stringify({ email, password }) },
      );
      onAuthenticated?.(session);
      resetForm();
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Could not create your account",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const resendCode = async () => {
    setIsResending(true);
    try {
      await requestCode();
      setCode("");
      toast({ title: "Code resent", description: `A new code is on its way to ${email}.` });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Could not resend the code.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  if (step === "password") {
    return (
      <div className="w-full" style={{ color: "hsl(0 0% 10%)" }}>
        <div className="max-w-md mx-auto text-center py-4">
          <div className="mx-auto mb-6 flex items-center justify-center rounded-full" style={{ width: 56, height: 56, background: "#FBE3D3", color: "#EA5404" }}>
            <User className="w-6 h-6" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-light tracking-tight">Create your password</h2>
          <p className="mt-3 text-sm sm:text-base" style={{ color: "hsl(0 0% 40%)" }}>
            Email confirmed. Set a password to finish and access your Builders Node account.
          </p>

          <form
            className="mt-8 space-y-4 text-left"
            onSubmit={(e) => {
              e.preventDefault();
              void createAccount();
            }}
          >
            <input type="email" value={email} readOnly hidden autoComplete="username" />
            <div className="space-y-2">
              <Label className="text-sm font-medium" style={{ color: "hsl(0 0% 10%)" }}>Password</Label>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                autoFocus
                onChange={(e) => setPassword(e.target.value)}
                className="border-0 bg-white shadow-sm focus-visible:ring-1"
                style={{ color: "hsl(0 0% 10%)" }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium" style={{ color: "hsl(0 0% 10%)" }}>Confirm password</Label>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="border-0 bg-white shadow-sm focus-visible:ring-1"
                style={{ color: "hsl(0 0% 10%)" }}
              />
            </div>

            <Button
              type="submit"
              disabled={isCreatingAccount}
              className="w-full h-12 text-sm tracking-[0.15em] uppercase font-medium rounded-lg"
              style={{ backgroundColor: "hsl(0 0% 10%)", color: "hsl(30 30% 93%)" }}
            >
              {isCreatingAccount ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create account & finish"
              )}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (step === "code") {
    return (
      <div className="w-full" style={{ color: "hsl(0 0% 10%)" }}>
        <div className="max-w-md mx-auto text-center py-4">
          <div className="mx-auto mb-6 flex items-center justify-center rounded-full" style={{ width: 56, height: 56, background: "#FBE3D3", color: "#EA5404" }}>
            <Mail className="w-6 h-6" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-light tracking-tight">Confirm your email</h2>
          <p className="mt-3 text-sm sm:text-base" style={{ color: "hsl(0 0% 40%)" }}>
            We sent a 6-digit code to <strong style={{ color: "hsl(0 0% 15%)" }}>{email}</strong>.
            Enter it below to submit your application.
          </p>

          <form
            className="mt-8 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              void verifyCode();
            }}
          >
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              value={code}
              autoFocus
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mx-auto w-full max-w-[16rem] h-16 text-center border-0 bg-white shadow-sm focus-visible:ring-1"
              style={{ fontSize: "2rem", letterSpacing: "0.5rem", fontWeight: 600, color: "hsl(0 0% 10%)" }}
            />

            <Button
              type="submit"
              disabled={isVerifying || code.length !== 6}
              className="w-full h-12 text-sm tracking-[0.15em] uppercase font-medium rounded-lg"
              style={{ backgroundColor: "hsl(0 0% 10%)", color: "hsl(30 30% 93%)" }}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify & Submit"
              )}
            </Button>
          </form>

          <div className="mt-6 text-sm" style={{ color: "hsl(0 0% 45%)" }}>
            Didn&apos;t get it?{" "}
            <button
              type="button"
              onClick={() => void resendCode()}
              disabled={isResending}
              className="font-medium underline underline-offset-2 disabled:opacity-50"
              style={{ color: "hsl(0 0% 15%)" }}
            >
              {isResending ? "Resending..." : "Resend code"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setStep("form")}
            className="mt-6 inline-flex items-center gap-2 text-sm"
            style={{ color: "hsl(0 0% 45%)" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Use a different email
          </button>
        </div>
      </div>
    );
  }

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
              First arrivals start {batch.longDate}. Memberships begin on the first of each month.
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
            <RadioGroup value={selectedPlan?.id ?? ""} onValueChange={setPlan} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {plansLoading ? <p className="text-xs" style={{ color: "hsl(0 0% 45%)" }}>Loading plans…</p> : null}
              {plans.map((option) => (
                <label
                  key={option.id}
                  htmlFor={`plan-${option.id}`}
                  className={`rounded-lg p-4 bg-white cursor-pointer border transition-colors ${selectedPlan?.id === option.id ? "border-black" : "border-transparent"}`}
                >
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value={option.id} id={`plan-${option.id}`} className="mt-1" />
                    <div>
                      <p className="text-lg font-medium" style={{ color: "hsl(0 0% 10%)" }}>${priceOf(option).toLocaleString()}/month</p>
                      <p className="text-xs mt-1" style={{ color: "hsl(0 0% 35%)" }}>
                        {option.name} · {option.occupancy} {option.occupancy === 1 ? "person" : "people"}
                      </p>
                      {option.description ? (
                        <p className="text-xs mt-1" style={{ color: "hsl(0 0% 35%)" }}>{option.description}</p>
                      ) : null}
                    </div>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Social links */}
          <div className="space-y-3">
            <Label className="text-sm font-medium" style={{ color: "hsl(0 0% 10%)" }}>
              Your socials
            </Label>
            <p className="text-xs" style={{ color: "hsl(0 0% 45%)" }}>
              Optional — they help us get to know you faster.
            </p>
            {/* Plain text, not type="url": the browser refuses to submit a form
                holding a url field with "twitter.com/me" in it, which would let
                an optional answer block the whole application. The server
                prepends the scheme and drops anything it can't parse. */}
            <div className="space-y-3">
              <Input
                type="text"
                inputMode="url"
                placeholder="twitter.com/… (optional)"
                value={social1}
                onChange={(e) => setSocial1(e.target.value)}
                className="border-0 bg-white shadow-sm focus-visible:ring-1"
                style={{ borderColor: "hsl(0 0% 80%)", color: "hsl(0 0% 10%)" }}
              />
              <Input
                type="text"
                inputMode="url"
                placeholder="linkedin.com/in/… (optional)"
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
            {/* Say where it came from, so a filled-in field doesn't look like
                something they typed and forgot. */}
            {arrivedWithReferral ? (
              <p className="text-xs" style={{ color: "hsl(0 0% 45%)" }}>
                Filled in from the invite link you followed.
              </p>
            ) : null}
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
                Sending code...
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </form>
    </div>
  );
};

export default ApplyForm;
