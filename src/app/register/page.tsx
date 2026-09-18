"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { registerInstitution, uploadLogo } from "@/lib/auth/register-action";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle,
  Mail,
  ArrowLeft,
  Timer,
  Upload,
  Building2,
  Phone,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  Check,
  X,
  AlertCircle,
} from "lucide-react";
import { useLang } from "@/contexts/language-context";
import { useTheme } from "@/contexts/theme-context";

interface PasswordRule {
  label: string;
  test: (p: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "One number", test: (p) => /[0-9]/.test(p) },
  { label: "One special character (!@#$%^&*)", test: (p) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(p) },
];

const MAX_LOGO_SIZE = 500 * 1024;

export default function RegisterPage() {
  const { t } = useLang();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<"form" | "verify">("form");
  const [submitted, setSubmitted] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoError, setLogoError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    nameBangla: "",
    nameEnglish: "",
    phone: "",
    whatsapp: "",
    address: "",
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError("");
    if (file.size > MAX_LOGO_SIZE) {
      setLogoError(`Logo must be under 500KB. Current: ${(file.size / 1024).toFixed(0)}KB`);
      e.target.value = "";
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const passwordValid = PASSWORD_RULES.every((r) => r.test(password));
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  const isFormValid =
    email.length > 0 &&
    passwordValid &&
    passwordsMatch &&
    form.nameBangla.length > 0 &&
    form.nameEnglish.length > 0 &&
    form.address.length > 0 &&
    form.phone.length > 0 &&
    form.whatsapp.length > 0;

  const sendVerificationCode = useCallback(async () => {
    if (!email) return;
    setSending(true);
    setEmailError("");

    try {
      // Use Supabase Auth to send a verification OTP to the email
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          data: { purpose: "institution_registration" },
        },
      });

      if (error) {
        setEmailError(error.message || "Failed to send verification code");
      } else {
        setCountdown(60);
        setEmailError("");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setEmailError(`Failed: ${msg}`);
    } finally {
      setSending(false);
    }
  }, [email]);

  const verifyCode = async () => {
    if (verificationCode.length !== 6) return;

    setSending(true);
    setEmailError("");

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: verificationCode,
        type: "email",
      });

      if (error) {
        setEmailError(error.message || "Invalid verification code. Please try again.");
        setSending(false);
        return;
      }

      // Verification succeeded — proceed with registration
      await handleSubmit();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setEmailError(`Verification failed: ${msg}`);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setEmailError("");

    try {
      const slug = form.nameEnglish
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      let logoUrl = "";
      if (logoFile) {
        try {
          const buffer = await logoFile.arrayBuffer();
          const ext = logoFile.name.split(".").pop() || "png";
          logoUrl = await uploadLogo(slug, buffer, ext);
        } catch {
          // Logo upload failed, continue without logo
        }
      }

      const result = await registerInstitution({
        name: form.nameBangla || form.nameEnglish,
        nameEnglish: form.nameEnglish,
        code: `INST-${Date.now().toString(36).toUpperCase().slice(-6)}`,
        slug,
        email,
        phone: form.phone,
        whatsapp: form.whatsapp,
        address: form.address,
        logoUrl,
        password,
      });

      if (!result.success) {
        setEmailError(result.error || "Registration failed");
        return;
      }

      setSubmitted(true);
    } catch (err: unknown) {
      let msg = "Unknown error";
      if (err instanceof Error) {
        msg = err.message;
      } else if (typeof err === "object" && err !== null) {
        msg = JSON.stringify(err);
      } else {
        msg = String(err);
      }
      setEmailError(`Registration failed: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const proceedToVerify = async () => {
    if (!isFormValid) return;
    setStep("verify");
    await sendVerificationCode();
  };

  const resendCode = async () => {
    await sendVerificationCode();
  };

  const bg = isDark ? "bg-[#0a0a0b]" : "bg-zinc-50";
  const text = isDark ? "text-zinc-100" : "text-zinc-900";
  const textSec = isDark ? "text-zinc-400" : "text-zinc-500";
  const border = isDark ? "border-white/[0.06]" : "border-zinc-200";
  const glassCard = isDark
    ? "bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08]"
    : "bg-white border border-zinc-200 shadow-sm";
  const inputBg = isDark
    ? "bg-white/[0.05] border border-white/[0.08]"
    : "bg-white border border-zinc-200 shadow-sm";
  const linkBlue = isDark
    ? "text-blue-400 hover:text-blue-300"
    : "text-blue-600 hover:text-blue-700";

  if (submitted) {
    return (
      <div className={`h-dvh flex items-center justify-center ${bg}`}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px]" />
        </div>
        <div className="text-center max-w-md relative z-10 px-4">
          <div className="w-20 h-20 rounded-md bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            {mounted && <CheckCircle className="h-10 w-10 text-emerald-400" />}
          </div>
          <h1 className={`text-2xl font-bold mb-3 ${text}`}>
            Registration Complete
          </h1>
          <p className={`text-sm mb-4 leading-relaxed ${textSec}`}>
            Your institution registration has been submitted successfully.
            We&#39;ll review your application and notify you once approved.
          </p>
          <p
            className={`text-sm mb-8 leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-600"}`}
          >
            You can now sign in with your email and password. Your account will
            be active once an administrator approves your institution.
          </p>
          <Link
            href="/login"
            className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${linkBlue}`}
          >
            {mounted && <ArrowLeft className="h-4 w-4" />} Back to Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-dvh ${bg} relative overflow-hidden flex flex-col`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-32 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 -right-32 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 relative z-10 overflow-y-auto">
        <div className="w-full max-w-5xl">
          <div className="text-center mb-6">
            <h1 className={`text-2xl font-bold mb-2 ${text}`}>
              Institution Registration
            </h1>
            <p className={`text-sm ${textSec}`}>
              Register your institution to join BMA platform
            </p>
          </div>

          <Card className={glassCard}>
            <CardContent className="p-6">
              {step === "form" ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column - Institution Details */}
                  <div className="space-y-6">
                    <div
                      className={`flex items-center gap-5 pb-5 border-b ${border}`}
                    >
                      <div className="relative">
                        {logoPreview ? (
                          <div
                            className={`h-16 w-16 rounded-md overflow-hidden ${isDark ? "border-2 border-white/10" : "border-2 border-zinc-200"}`}
                          >
                            <Image
                              src={logoPreview}
                              alt="Logo"
                              width={64}
                              height={64}
                              unoptimized
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div
                            className={`h-16 w-16 rounded-md flex items-center justify-center ${isDark ? "bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/[0.06]" : "bg-zinc-100 border border-zinc-200"}`}
                          >
                            {mounted && (
                              <Building2
                                className={`h-6 w-6 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                              />
                            )}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className={`text-sm font-medium mb-1 ${text}`}>
                          Institution Logo
                        </p>
                        <p className={`text-xs ${textSec} mb-2`}>
                          Upload your institution logo (max 500KB)
                        </p>
                        <label
                          className={`inline-flex items-center gap-2 text-sm cursor-pointer transition-colors ${linkBlue}`}
                        >
                          {mounted && <Upload className="h-4 w-4" />}
                          Choose file
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoChange}
                            className="hidden"
                          />
                        </label>
                        {logoError && (
                          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {logoError}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className={`text-sm font-medium mb-4 ${text}`}>
                        Institution Details
                      </p>
                      <div className="space-y-4">
                        <div>
                          <label
                            className={`flex items-center gap-2 text-xs mb-2 ${textSec}`}
                          >
                            <span>নাম (বাংলা) <span className="text-red-400">*</span></span>
                          </label>
                          <Input
                            value={form.nameBangla}
                            onChange={(e) => update("nameBangla", e.target.value)}
                            placeholder="মাদ্রাসার নাম"
                            className={inputBg}
                            required
                          />
                        </div>
                        <div>
                          <label
                            className={`flex items-center gap-2 text-xs mb-2 ${textSec}`}
                          >
                            <span>Name (English) <span className="text-red-400">*</span></span>
                          </label>
                          <Input
                            value={form.nameEnglish}
                            onChange={(e) =>
                              update("nameEnglish", e.target.value)
                            }
                            placeholder="Institution Name"
                            className={inputBg}
                            required
                          />
                        </div>
                        <div>
                          <label
                            className={`flex items-center gap-2 text-xs mb-2 ${textSec}`}
                          >
                            {mounted && <MapPin className="h-3.5 w-3.5" />}
                            <span>Address <span className="text-red-400">*</span></span>
                          </label>
                          <Input
                            value={form.address}
                            onChange={(e) => update("address", e.target.value)}
                            placeholder="Village, Area, District"
                            className={inputBg}
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Contact & Password */}
                  <div className="space-y-6">
                    <div>
                      <p className={`text-sm font-medium mb-4 ${text}`}>
                        Contact Information
                      </p>
                      <div className="space-y-4">
                        <div>
                          <label
                            className={`flex items-center gap-2 text-xs mb-2 ${textSec}`}
                          >
                            {mounted && <Mail className="h-3.5 w-3.5" />}
                            <span>Email Address <span className="text-red-400">*</span></span>
                          </label>
                          <Input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="info@institution.edu"
                            className={inputBg}
                            required
                          />
                        </div>

                        {/* Password */}
                        <div>
                          <label
                            className={`flex items-center gap-2 text-xs mb-2 ${textSec}`}
                          >
                            {mounted && <Lock className="h-3.5 w-3.5" />}
                            <span>Password <span className="text-red-400">*</span></span>
                          </label>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="Create a strong password"
                              className={`${inputBg} pr-10`}
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600"}`}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>

                          {/* Password strength rules */}
                          {password.length > 0 && (
                            <div className="mt-3 space-y-1.5">
                              {PASSWORD_RULES.map((rule) => {
                                const pass = rule.test(password);
                                return (
                                  <div
                                    key={rule.label}
                                    className="flex items-center gap-2"
                                  >
                                    {pass ? (
                                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                    ) : (
                                      <X className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                                    )}
                                    <span
                                      className={`text-xs ${pass ? "text-emerald-400" : isDark ? "text-zinc-500" : "text-zinc-400"}`}
                                    >
                                      {rule.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Confirm Password */}
                        <div>
                          <label
                            className={`flex items-center gap-2 text-xs mb-2 ${textSec}`}
                          >
                            {mounted && <Lock className="h-3.5 w-3.5" />}
                            <span>Confirm Password <span className="text-red-400">*</span></span>
                          </label>
                          <Input
                            type={showPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter password"
                            className={inputBg}
                            required
                          />
                          {confirmPassword && !passwordsMatch && (
                            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Passwords do not match
                            </p>
                          )}
                          {confirmPassword && passwordsMatch && (
                            <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                              <Check className="h-3 w-3" />
                              Passwords match
                            </p>
                          )}
                        </div>

                        <div>
                          <label
                            className={`flex items-center gap-2 text-xs mb-2 ${textSec}`}
                          >
                            {mounted && <Phone className="h-3.5 w-3.5" />}
                            <span>Phone Number <span className="text-red-400">*</span></span>
                          </label>
                          <Input
                            value={form.phone}
                            onChange={(e) => update("phone", e.target.value)}
                            placeholder="+880 1XXX XXXXXX"
                            className={inputBg}
                            required
                          />
                        </div>
                        <div>
                          <label
                            className={`flex items-center gap-2 text-xs mb-2 ${textSec}`}
                          >
                            {mounted && <Phone className="h-3.5 w-3.5" />}
                            <span>WhatsApp Number <span className="text-red-400">*</span></span>
                          </label>
                          <Input
                            value={form.whatsapp}
                            onChange={(e) => update("whatsapp", e.target.value)}
                            placeholder="+880 1XXX XXXXXX"
                            className={inputBg}
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Verification Step */
                <div className="max-w-sm mx-auto py-4">
                  <div className="text-center mb-6">
                    <div
                      className={`w-14 h-14 rounded-md flex items-center justify-center mx-auto mb-3 ${isDark ? "bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20" : "bg-blue-50 border border-blue-200"}`}
                    >
                      {mounted && (
                        <Mail
                          className={`h-6 w-6 ${isDark ? "text-blue-400" : "text-blue-600"}`}
                        />
                      )}
                    </div>
                    <h2 className={`text-lg font-semibold mb-2 ${text}`}>
                      Verify Your Email
                    </h2>
                    <p className={`text-sm ${textSec}`}>
                      We&#39;ve sent a code to
                      <br />
                      <span
                        className={`font-medium ${isDark ? "text-blue-400" : "text-blue-600"}`}
                      >
                        {email}
                      </span>
                    </p>
                  </div>

                  <div className="space-y-4">
                    {emailError && (
                      <div className="flex items-center gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/20">
                        <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                        <p className="text-xs text-red-400">{emailError}</p>
                      </div>
                    )}

                    <div>
                      <label
                        className={`block text-xs mb-2 ${textSec}`}
                      >
                        Enter 6-digit code
                      </label>
                      <Input
                        value={verificationCode}
                        onChange={(e) =>
                          setVerificationCode(
                            e.target.value.replace(/\D/g, "").slice(0, 6)
                          )
                        }
                        placeholder="000000"
                        className={`${inputBg} text-center text-lg tracking-[0.5em] font-mono h-12`}
                        maxLength={6}
                        required
                      />
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <button
                        onClick={resendCode}
                        disabled={countdown > 0 || sending}
                        className={`transition-colors ${linkBlue} ${countdown > 0 || sending ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {sending ? "Sending..." : "Resend code"}
                      </button>
                      {countdown > 0 && (
                        <span
                          className={`flex items-center gap-1.5 ${textSec}`}
                        >
                          {mounted && <Timer className="h-4 w-4" />}
                          {countdown}s
                        </span>
                      )}
                    </div>

                    <Button
                      type="button"
                      className="w-full h-11"
                      onClick={verifyCode}
                      disabled={verificationCode.length !== 6 || submitting}
                    >
                      {submitting ? (
                        <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        "Verify & Register"
                      )}
                    </Button>

                    <button
                      onClick={() => {
                        setStep("form");
                        setEmailError("");
                        setVerificationCode("");
                      }}
                      className={`w-full text-sm ${textSec} transition-colors ${isDark ? "hover:text-white" : "hover:text-zinc-700"}`}
                    >
                      Change email address
                    </button>
                  </div>
                </div>
              )}

              {step === "form" && (
                <div
                  className={`flex items-center justify-between pt-6 mt-6 border-t ${border}`}
                >
                  <p className={`text-sm ${textSec}`}>
                    Already registered?{" "}
                    <Link
                      href="/login"
                      className={`font-medium transition-colors ${linkBlue}`}
                    >
                      Sign in
                    </Link>
                  </p>
                  <Button
                    type="button"
                    size="lg"
                    onClick={proceedToVerify}
                    disabled={!isFormValid || sending}
                  >
                    {mounted && <Mail className="h-4 w-4" />}
                    <span>{sending ? "Sending code..." : "Continue"}</span>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="text-center mt-4 pb-4">
            <p className={`text-xs ${textSec}`}>
              By registering, you agree to our{" "}
              <a
                href="#"
                className={`transition-colors ${linkBlue}`}
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="#"
                className={`transition-colors ${linkBlue}`}
              >
                Privacy Policy
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
