"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { initializeDemoData } from "@/lib/storage/seed";
import { createInstitution } from "@/lib/storage/institutions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Mail, ArrowLeft, Timer, Upload, Building2, User, Phone, MapPin, BookOpen, FileText, Award } from "lucide-react";
import { useLang } from "@/contexts/language-context";
import { useTheme } from "@/contexts/theme-context";

export default function RegisterPage() {
  const { t } = useLang();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<"form" | "verify">("form");
  const [submitted, setSubmitted] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [form, setForm] = useState({
    nameBangla: "",
    nameEnglish: "",
    phone: "",
    whatsapp: "",
    address: "",
    principalName: "",
    principalPhone: "",
  });

  useEffect(() => { 
    initializeDemoData(); 
    setMounted(true);
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
    }
  };

  const sendVerificationCode = () => {
    if (!email) return;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setCountdown(60);
    localStorage.setItem("scholarx_verification_code", code);
    localStorage.setItem("scholarx_verification_email", email);
    alert(`Verification code: ${code}`);
  };

  const verifyCode = () => {
    const storedCode = localStorage.getItem("scholarx_verification_code");
    const storedEmail = localStorage.getItem("scholarx_verification_email");
    if (verificationCode === storedCode && email === storedEmail) {
      handleSubmit();
    } else {
      alert("Invalid verification code. Please try again.");
    }
  };

  const handleSubmit = () => {
    const slug = form.nameEnglish.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || 
                 form.nameBangla.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    createInstitution({
      name: form.nameBangla || form.nameEnglish,
      code: `INST-${Date.now().toString(36).toUpperCase().slice(-6)}`,
      slug,
      email,
      phone: form.phone,
      address: form.address,
      city: "",
      district: "",
      contactPerson: form.principalName,
      contactPersonPhone: form.principalPhone,
      status: "PENDING",
      totalStudents: 0,
      totalApplications: 0,
    });
    setSubmitted(true);
  };

  const proceedToVerify = () => {
    if (!email || (!form.nameBangla && !form.nameEnglish)) return;
    setStep("verify");
    sendVerificationCode();
  };

  const resendCode = () => {
    sendVerificationCode();
  };

  const bg = isDark ? "bg-[#0a0a0b]" : "bg-zinc-50";
  const text = isDark ? "text-zinc-100" : "text-zinc-900";
  const textSec = isDark ? "text-zinc-400" : "text-zinc-500";
  const border = isDark ? "border-white/[0.06]" : "border-zinc-200/50";
  const glassCard = isDark 
    ? "bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08]" 
    : "bg-white/70 backdrop-blur-xl border border-white/80";
  const inputBg = isDark ? "bg-white/[0.05]" : "bg-white";

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
          <h1 className={`text-2xl font-bold mb-3 ${text}`}>Registration Complete</h1>
          <p className={`text-sm mb-8 leading-relaxed ${textSec}`}>
            Your institution registration has been submitted successfully. We'll review your application and notify you once approved.
          </p>
          <Link href="/login" className={`inline-flex items-center gap-2 text-sm font-medium ${isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-700'} transition-colors`}>
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
            <h1 className={`text-2xl font-bold mb-2 ${text}`}>Institution Registration</h1>
            <p className={`text-sm ${textSec}`}>Register your institution to join BMES platform</p>
          </div>

          <Card className={glassCard}>
            <CardContent className="p-6">
              {step === "form" ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Right Column - Contact & Principal */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-5 pb-5 border-b border-white/[0.06]">
                      <div className="relative">
                        {logoPreview ? (
                          <div className="h-16 w-16 rounded-xl overflow-hidden border-2 border-white/10">
                            <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/[0.06] flex items-center justify-center">
                            {mounted && <Building2 className="h-6 w-6 text-zinc-600" />}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className={`text-sm font-medium mb-1 ${text}`}>Institution Logo</p>
                        <p className={`text-xs ${textSec} mb-2`}>Upload your institution logo</p>
                        <label className="inline-flex items-center gap-2 text-sm text-blue-400 cursor-pointer hover:text-blue-300 transition-colors">
                          {mounted && <Upload className="h-4 w-4" />}
                          Choose file
                          <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                        </label>
                      </div>
                    </div>

                    <div>
                      <p className={`text-sm font-medium mb-4 ${text}`}>Institution Details</p>
                      <div className="space-y-4">
                        <div>
                          <label className={`flex items-center gap-2 text-xs mb-2 ${textSec}`}>
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
                          <label className={`flex items-center gap-2 text-xs mb-2 ${textSec}`}>
                            <span>Name (English)</span>
                          </label>
                          <Input
                            value={form.nameEnglish}
                            onChange={(e) => update("nameEnglish", e.target.value)}
                            placeholder="Institution Name"
                            className={inputBg}
                          />
                        </div>
                        <div>
                          <label className={`flex items-center gap-2 text-xs mb-2 ${textSec}`}>
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

                  {/* Left Column - Institution Details */}
                  <div className="space-y-6">
                    <div>
                      <p className={`text-sm font-medium mb-4 ${text}`}>Contact Information</p>
                      <div className="space-y-4">
                        <div>
                          <label className={`flex items-center gap-2 text-xs mb-2 ${textSec}`}>
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
                        <div>
                          <label className={`flex items-center gap-2 text-xs mb-2 ${textSec}`}>
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
                          <label className={`flex items-center gap-2 text-xs mb-2 ${textSec}`}>
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

                    <div>
                      <p className={`text-sm font-medium mb-4 ${text}`}>Principal Information</p>
                      <div className="space-y-4">
                        <div>
                          <label className={`flex items-center gap-2 text-xs mb-2 ${textSec}`}>
                            {mounted && <User className="h-3.5 w-3.5" />}
                            <span>Principal Name</span>
                          </label>
                          <Input
                            value={form.principalName}
                            onChange={(e) => update("principalName", e.target.value)}
                            placeholder="Principal Full Name"
                            className={inputBg}
                          />
                        </div>
                        <div>
                          <label className={`flex items-center gap-2 text-xs mb-2 ${textSec}`}>
                            {mounted && <Phone className="h-3.5 w-3.5" />}
                            <span>Principal Phone</span>
                          </label>
                          <Input
                            value={form.principalPhone}
                            onChange={(e) => update("principalPhone", e.target.value)}
                            placeholder="+880 1XXX XXXXXX"
                            className={inputBg}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="max-w-sm mx-auto py-4">
                  <div className="text-center mb-6">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-3">
                      {mounted && <Mail className="h-6 w-6 text-blue-400" />}
                    </div>
                    <h2 className={`text-lg font-semibold mb-2 ${text}`}>Verify Your Email</h2>
                    <p className={`text-sm ${textSec}`}>
                      We've sent a code to<br />
                      <span className="text-blue-400 font-medium">{email}</span>
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className={`block text-xs mb-2 ${textSec}`}>Enter 6-digit code</label>
                      <Input
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="000000"
                        className={`${inputBg} text-center text-lg tracking-[0.5em] font-mono h-12`}
                        maxLength={6}
                      />
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <button 
                        onClick={resendCode} 
                        disabled={countdown > 0}
                        className={`text-blue-400 hover:text-blue-300 transition-colors ${countdown > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        Resend code
                      </button>
                      {countdown > 0 && (
                        <span className={`flex items-center gap-1.5 ${textSec}`}>
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
                      onClick={() => setStep("form")} 
                      className={`w-full text-sm ${textSec} hover:text-white transition-colors`}
                    >
                      Change email address
                    </button>
                  </div>
                </div>
              )}

              {step === "form" && (
                <div className="flex items-center justify-between pt-6 mt-6 border-t border-white/[0.06]">
                  <p className={`text-sm ${textSec}`}>
                    Already registered?{" "}
                    <Link href="/login" className="text-blue-400 hover:text-blue-300 transition-colors font-medium">
                      Sign in
                    </Link>
                  </p>
                  <Button 
                    type="button" 
                    size="lg"
                    onClick={proceedToVerify}
                    disabled={!email || (!form.nameBangla && !form.nameEnglish)}
                  >
                    {mounted && <Mail className="h-4 w-4" />}
                    <span>Continue</span>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="text-center mt-6">
            <p className={`text-xs ${textSec}`}>
              By registering, you agree to our{" "}
              <a href="#" className="text-blue-400 hover:text-blue-300 transition-colors">Terms of Service</a>
              {" "}and{" "}
              <a href="#" className="text-blue-400 hover:text-blue-300 transition-colors">Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
