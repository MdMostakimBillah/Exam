"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import emailjs from "@emailjs/browser";
import { initializeDemoData } from "@/lib/storage/seed";
import { createInstitution, updateInstitution } from "@/lib/storage/institutions";
import { createUser } from "@/lib/storage/users";
import { EMAILJS_CONFIG, EMAIL_TEMPLATE_PARAMS } from "@/lib/emailjs/config";
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

export default function RegisterPage() {
  const { t } = useLang();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<"form" | "verify">("form");
  const [submitted, setSubmitted] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [storedCode, setStoredCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [form, setForm] = useState({
    nameBangla: "",
    nameEnglish: "",
    phone: "",
    whatsapp: "",
    address: "",
  });

  useEffect(() => {
    initializeDemoData();
    emailjs.init(EMAILJS_CONFIG.publicKey);
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
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
    }
  };

  const passwordValid = PASSWORD_RULES.every((r) => r.test(password));
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  const isFormValid =
    email.length > 0 &&
    passwordValid &&
    passwordsMatch &&
    (form.nameBangla.length > 0 || form.nameEnglish.length > 0);

  const sendVerificationCode = useCallback(async () => {
    if (!email) return;
    setSending(true);
    setEmailError("");
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const instName = form.nameEnglish || form.nameBangla || "Your Institution";

    try {
      await emailjs.send(
        EMAILJS_CONFIG.serviceId,
        EMAILJS_CONFIG.templateId,
        {
          ...EMAIL_TEMPLATE_PARAMS,
          to_email: email,
          verification_code: code,
          institution_name: instName,
        },
        { publicKey: EMAILJS_CONFIG.publicKey }
      );
      setStoredCode(code);
      setCountdown(60);
    } catch (err: unknown) {
      console.error("EmailJS error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setEmailError(
        `Failed to send email: ${msg}`
      );
    } finally {
      setSending(false);
    }
  }, [email, form.nameEnglish, form.nameBangla]);

  const verifyCode = () => {
    if (verificationCode === storedCode) {
      handleSubmit();
    } else {
      setEmailError("Invalid verification code. Please try again.");
    }
  };

  const handleSubmit = () => {
    const slug =
      form.nameEnglish
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") ||
      form.nameBangla.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const institution = createInstitution({
      name: form.nameBangla || form.nameEnglish,
      code: `INST-${Date.now().toString(36).toUpperCase().slice(-6)}`,
      slug,
      email,
      phone: form.phone,
      address: form.address,
      city: "",
      district: "",
      contactPerson: "",
      contactPersonPhone: "",
      status: "PENDING",
      totalStudents: 0,
      totalApplications: 0,
    });

    const adminName = form.nameEnglish || form.nameBangla;
    const user = createUser({
      email,
      name: adminName,
      password,
      role: "INSTITUTION_ADMIN",
      institutionId: institution.id,
    });

    updateInstitution(institution.id, { adminUserId: user.id });
    setSubmitted(true);
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
      <div className={`min-h-screen flex items-center justify-center ${bg}`}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px]" />
        </div>
        <div className="text-center max-w-md relative z-10 px-4">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
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
    <div className={`min-h-screen ${bg} relative overflow-hidden`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-32 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 -right-32 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="p-6 lg:p-8 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className={`text-2xl font-bold mb-2 ${text}`}>
              Institution Registration
            </h1>
            <p className={`text-sm ${textSec}`}>
              Register your institution to join BMES platform
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
                            className={`h-16 w-16 rounded-xl overflow-hidden ${isDark ? "border-2 border-white/10" : "border-2 border-zinc-200"}`}
                          >
                            <img
                              src={logoPreview}
                              alt="Logo"
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div
                            className={`h-16 w-16 rounded-xl flex items-center justify-center ${isDark ? "bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/[0.06]" : "bg-zinc-100 border border-zinc-200"}`}
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
                          Upload your institution logo
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
                            <span>নাম (বাংলা)</span>
                          </label>
                          <Input
                            value={form.nameBangla}
                            onChange={(e) => update("nameBangla", e.target.value)}
                            placeholder="মাদ্রাসার নাম"
                            className={inputBg}
                          />
                        </div>
                        <div>
                          <label
                            className={`flex items-center gap-2 text-xs mb-2 ${textSec}`}
                          >
                            <span>Name (English)</span>
                          </label>
                          <Input
                            value={form.nameEnglish}
                            onChange={(e) =>
                              update("nameEnglish", e.target.value)
                            }
                            placeholder="Institution Name"
                            className={inputBg}
                          />
                        </div>
                        <div>
                          <label
                            className={`flex items-center gap-2 text-xs mb-2 ${textSec}`}
                          >
                            {mounted && <MapPin className="h-3.5 w-3.5" />}
                            <span>Address</span>
                          </label>
                          <Input
                            value={form.address}
                            onChange={(e) => update("address", e.target.value)}
                            placeholder="Village, Area, District"
                            className={inputBg}
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
                            <span>Email Address</span>
                          </label>
                          <Input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="info@institution.edu"
                            className={inputBg}
                          />
                        </div>

                        {/* Password */}
                        <div>
                          <label
                            className={`flex items-center gap-2 text-xs mb-2 ${textSec}`}
                          >
                            {mounted && <Lock className="h-3.5 w-3.5" />}
                            <span>Password</span>
                          </label>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="Create a strong password"
                              className={`${inputBg} pr-10`}
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
                            <span>Confirm Password</span>
                          </label>
                          <Input
                            type={showPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter password"
                            className={inputBg}
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
                            <span>Phone Number</span>
                          </label>
                          <Input
                            value={form.phone}
                            onChange={(e) => update("phone", e.target.value)}
                            placeholder="+880 1XXX XXXXXX"
                            className={inputBg}
                          />
                        </div>
                        <div>
                          <label
                            className={`flex items-center gap-2 text-xs mb-2 ${textSec}`}
                          >
                            {mounted && <Phone className="h-3.5 w-3.5" />}
                            <span>WhatsApp Number</span>
                          </label>
                          <Input
                            value={form.whatsapp}
                            onChange={(e) => update("whatsapp", e.target.value)}
                            placeholder="+880 1XXX XXXXXX"
                            className={inputBg}
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
                      className={`w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3 ${isDark ? "bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20" : "bg-blue-50 border border-blue-200"}`}
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
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
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
                      disabled={verificationCode.length !== 6}
                    >
                      Verify & Register
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

          <div className="text-center mt-6">
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
