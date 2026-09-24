"use client";
import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth/auth";
import { Settings, Building2, User, Lock, Bell, Save, Eye, EyeOff, CheckCircle2, Calendar, Plus, Trash2, Check, X, CreditCard, Palette, Upload } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";
import { createClient } from "@/lib/supabase/client";
import { useSessions, useCreateSession, useSetCurrentSession, useUpdateSession, useDeleteSession } from "@/lib/storage/sessions";
import { useBranding, useSaveBranding, uploadBrandingImage, BRANDING_DEFAULTS, BrandingSettings } from "@/lib/storage/branding";
import { LoadingBar } from "@/components/ui/loading-bar";

type Tab = "profile" | "branding" | "account" | "password" | "notifications" | "sessions" | "payment";

interface PlatformSettings {
  platformName: string;
  contactEmail: string;
  supportPhone: string;
  address: string;
  emailNotifications: boolean;
  registrationAlerts: boolean;
  resultAlerts: boolean;
  paymentAlerts: boolean;
}

const DEFAULT_SETTINGS: PlatformSettings = {
  platformName: "Bangladesh Madrasah Association",
  contactEmail: "support@scholarx.local",
  supportPhone: "+880-2-XXXXXXXX",
  address: "",
  emailNotifications: true,
  registrationAlerts: true,
  resultAlerts: true,
  paymentAlerts: true,
};

const SETTINGS_KEY = "platform_settings";

export default function SuperAdminSettingsPage() {
  const { toast } = useToast();
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [saving, setSaving] = useState(false);

  // Auth
  const { user } = useAuth();

  // Sessions
  const { data: sessions = [], isFetching } = useSessions();
  const createSession = useCreateSession();
  const setCurrentSession = useSetCurrentSession();
  const updateSession = useUpdateSession();
  const deleteSession = useDeleteSession();

  // Profile fields
  const [platformName, setPlatformName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [address, setAddress] = useState("");

  // Account fields
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Notification toggles
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [registrationAlerts, setRegistrationAlerts] = useState(true);
  const [resultAlerts, setResultAlerts] = useState(true);
  const [paymentAlerts, setPaymentAlerts] = useState(true);

  // Sessions form
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [newSession, setNewSession] = useState({ name: "", code: "", startDate: "", endDate: "" });

  // Payment instruction fields (shown to institutions on the Payments page)
  const [paymentBkashNumber, setPaymentBkashNumber] = useState("");
  const [paymentBkashName, setPaymentBkashName] = useState("");
  const [paymentCashAddress, setPaymentCashAddress] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState("");

  // Branding (logo, association names, landing-page copy, PDF watermark)
  const { data: brandingData } = useBranding();
  const saveBranding = useSaveBranding();
  const [brandForm, setBrandForm] = useState<BrandingSettings | null>(null);
  const [uploadKind, setUploadKind] = useState<"" | "logo" | "watermark">("");

  // Seed the form once — later background refetches must not clobber edits.
  useEffect(() => {
    if (brandingData && !brandForm) setBrandForm({ ...brandingData });
  }, [brandingData, brandForm]);

  useEffect(() => {
    setMounted(true);
    // Load settings from Supabase
    const loadSettings = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['platformName', 'contactEmail', 'supportPhone', 'address', 'emailNotifications', 'registrationAlerts', 'resultAlerts', 'paymentAlerts', 'paymentBkashNumber', 'paymentBkashName', 'paymentCashAddress', 'paymentInstructions']);
      
      if (data) {
        const settingsMap = Object.fromEntries(data.map((s: any) => [s.key, s.value]));
        if (settingsMap.platformName) setPlatformName(settingsMap.platformName);
        if (settingsMap.contactEmail) setContactEmail(settingsMap.contactEmail);
        if (settingsMap.supportPhone) setSupportPhone(settingsMap.supportPhone);
        if (settingsMap.address) setAddress(settingsMap.address);
        if (settingsMap.emailNotifications) setEmailNotifications(settingsMap.emailNotifications === 'true');
        if (settingsMap.registrationAlerts) setRegistrationAlerts(settingsMap.registrationAlerts === 'true');
        if (settingsMap.resultAlerts) setResultAlerts(settingsMap.resultAlerts === 'true');
        if (settingsMap.paymentAlerts) setPaymentAlerts(settingsMap.paymentAlerts === 'true');
        if (settingsMap.paymentBkashNumber) setPaymentBkashNumber(settingsMap.paymentBkashNumber);
        if (settingsMap.paymentBkashName) setPaymentBkashName(settingsMap.paymentBkashName);
        if (settingsMap.paymentCashAddress) setPaymentCashAddress(settingsMap.paymentCashAddress);
        if (settingsMap.paymentInstructions) setPaymentInstructions(settingsMap.paymentInstructions);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    if (user) {
      setAdminName(user.name);
      setAdminEmail(user.email);
    }
  }, [user]);

  const tabs: { id: Tab; label: string; labelBn: string; icon: React.ReactNode }[] = useMemo(() => [
    { id: "profile", label: "Profile", labelBn: "প্রোফাইল", icon: <Building2 className="h-4 w-4" /> },
    { id: "branding", label: "Branding", labelBn: "ব্র্যান্ডিং", icon: <Palette className="h-4 w-4" /> },
    { id: "account", label: "Account", labelBn: "অ্যাকাউন্ট", icon: <User className="h-4 w-4" /> },
    { id: "password", label: "Password", labelBn: "পাসওয়ার্ড", icon: <Lock className="h-4 w-4" /> },
    { id: "sessions", label: "Academic Sessions", labelBn: "একাডেমিক সেশন", icon: <Calendar className="h-4 w-4" /> },
    { id: "payment", label: "Payment", labelBn: "পেমেন্ট", icon: <CreditCard className="h-4 w-4" /> },
    { id: "notifications", label: "Notifications", labelBn: "বিজ্ঞপ্তি", icon: <Bell className="h-4 w-4" /> },
  ], []);

  /** Map a system_settings write failure to a friendly bilingual toast. */
  const settingsErrorToast = (err: any) => {
    const msg = String(err?.message || "");
    if (err?.code === "42501" || /row-level security|permission denied/i.test(msg)) {
      toast("error", isBn
        ? "অনুমতি নেই: system_settings-এ সুপার অ্যাডমিন রাইট পলিসি নেই — সুপাবেস SQL এডিটরে 0017 ফিক্স SQL চালান"
        : "Not allowed: the super-admin write policy on system_settings is missing — run the 0017 fix SQL in the Supabase SQL Editor");
      return;
    }
    toast("error", msg || (isBn ? "সংরক্ষণ ব্যর্থ" : "Save failed"));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const supabase = createClient();
    const settings = [
      { key: 'platformName', value: platformName, category: 'platform' },
      { key: 'contactEmail', value: contactEmail, category: 'platform' },
      { key: 'supportPhone', value: supportPhone, category: 'platform' },
      { key: 'address', value: address, category: 'platform' },
    ];
    let saveError: any = null;
    for (const setting of settings) {
      const { error } = await supabase
        .from('system_settings')
        .upsert(setting, { onConflict: 'key' });
      if (error) { saveError = error; break; }
    }
    setSaving(false);
    if (saveError) { settingsErrorToast(saveError); return; }
    toast("success", isBn ? "প্রোফাইল সফলভাবে সংরক্ষিত হয়েছে!" : "Profile saved successfully!");
  };

  const handleSaveAccount = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    toast("success", isBn ? "অ্যাকাউন্ট সফলভাবে সংরক্ষিত হয়েছে!" : "Account saved successfully!");
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast("error", isBn ? "সব ঘর পূরণ করুন" : "All fields are required");
      return;
    }
    if (newPassword.length < 6) {
      toast("error", isBn ? "পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে" : "Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast("error", isBn ? "নতুন পাসওয়ার্ড মিলছে না" : "Passwords do not match");
      return;
    }
    setSaving(true);
    try {
      const { changePassword } = await import("@/lib/auth/server-auth");
      const result = await changePassword(currentPassword, newPassword);
      if (result.success) {
        toast("success", isBn ? "পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!" : "Password changed successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast("error", result.error || "Failed to change password");
      }
    } catch {
      toast("error", "Failed to change password");
    }
    setSaving(false);
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    const supabase = createClient();
    const settings = [
      { key: 'emailNotifications', value: String(emailNotifications), category: 'notifications' },
      { key: 'registrationAlerts', value: String(registrationAlerts), category: 'notifications' },
      { key: 'resultAlerts', value: String(resultAlerts), category: 'notifications' },
      { key: 'paymentAlerts', value: String(paymentAlerts), category: 'notifications' },
    ];
    let saveError: any = null;
    for (const setting of settings) {
      const { error } = await supabase
        .from('system_settings')
        .upsert(setting, { onConflict: 'key' });
      if (error) { saveError = error; break; }
    }
    setSaving(false);
    if (saveError) { settingsErrorToast(saveError); return; }
    toast("success", isBn ? "বিজ্ঞপ্তি সেটিংস সংরক্ষিত হয়েছে!" : "Notification settings saved!");
  };

  const handleSavePayment = async () => {
    setSaving(true);
    const supabase = createClient();
    const settings = [
      { key: 'paymentBkashNumber', value: paymentBkashNumber, category: 'payment' },
      { key: 'paymentBkashName', value: paymentBkashName, category: 'payment' },
      { key: 'paymentCashAddress', value: paymentCashAddress, category: 'payment' },
      { key: 'paymentInstructions', value: paymentInstructions, category: 'payment' },
    ];
    let saveError: any = null;
    for (const setting of settings) {
      const { error } = await supabase
        .from('system_settings')
        .upsert(setting, { onConflict: 'key' });
      if (error) { saveError = error; break; }
    }
    setSaving(false);
    if (saveError) { settingsErrorToast(saveError); return; }
    toast("success", isBn ? "পেমেন্ট তথ্য সংরক্ষিত হয়েছে!" : "Payment details saved!");
  };

  const handleBrandFile = async (kind: "logo" | "watermark", file?: File | null) => {
    if (!file || !brandForm) return;
    // Raster only — SVGs can silently fail to rasterise in html2canvas (PDF).
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast("error", isBn ? "শুধু PNG, JPG বা WEBP ছবি আপলোড করুন" : "Only PNG, JPG or WEBP images are allowed");
      return;
    }
    const MAX_BRAND_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_BRAND_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      toast("error", isBn ? `ছবির সর্বোচ্চ আকার 2MB — এটি ${sizeMB}MB` : `Maximum image size is 2MB — this one is ${sizeMB}MB`);
      return;
    }
    setUploadKind(kind);
    try {
      const url = await uploadBrandingImage(file, kind);
      if (kind === "logo") setBrandForm({ ...brandForm, brandLogo: url });
      else setBrandForm({ ...brandForm, brandWatermark: url });
      toast("success", isBn ? "ইমেজ আপলোড হয়েছে — এখন সংরক্ষণ করুন" : "Image uploaded — click Save Changes to apply");
    } catch (err: any) {
      toast("error", err?.message || (isBn ? "আপলোড ব্যর্থ" : "Upload failed"));
    } finally {
      setUploadKind("");
    }
  };

  const handleSaveBranding = async () => {
    if (!brandForm) return;
    setSaving(true);
    try {
      await saveBranding.mutateAsync(brandForm);
      toast("success", isBn ? "ব্র্যান্ডিং সংরক্ষিত হয়েছে!" : "Branding saved!");
    } catch (err: any) {
      settingsErrorToast(err);
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return <SettingsSkeleton isDark={isDark} />;

  const card = isDark ? "bg-[#141416] border border-white/[0.06] rounded-md" : "bg-white border border-zinc-200 rounded-md shadow-sm";
  const inputCls = isDark ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-white/10" : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-zinc-200";
  const labelCls = isDark ? "text-zinc-400" : "text-zinc-600";
  const subtextCls = isDark ? "text-zinc-500" : "text-zinc-500";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <LoadingBar isLoading={isFetching} />
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="mb-8">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? 'সেটিংস' : 'Settings'}
          </h1>
          <p className={`text-sm mt-1 ${subtextCls}`}>
            {isBn ? 'প্ল্যাটফর্ম পছন্দ কনফিগার করুন' : 'Configure platform preferences'}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-56 shrink-0">
            <div className={`${card} p-2`}>
              {tabs.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={cn("flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm transition-all duration-200",
                    activeTab === tab.id ? isDark ? "bg-white text-black font-medium" : "bg-zinc-900 text-white font-medium"
                      : isDark ? "text-zinc-500 hover:text-white hover:bg-white/[0.05]" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                  )}>
                  {tab.icon}
                  {isBn ? tab.labelBn : tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {/* Profile Tab */}
            {activeTab === "profile" && (
              <div className={`${card} p-6`}>
                <div className="mb-6">
                  <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'প্ল্যাটফর্ম পরিচয়' : 'Platform Information'}</h2>
                  <p className={`text-sm mt-1 ${subtextCls}`}>{isBn ? 'প্ল্যাটফর্মের মৌলিক তথ্য আপডেট করুন' : 'Update platform details'}</p>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'প্ল্যাটফর্মের নাম' : 'Platform Name'}</label>
                    <Input value={platformName} onChange={(e) => setPlatformName(e.target.value)} placeholder="Enter platform name" className={cn(inputCls, "h-10")} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'যোগাযোগ ইমেইল' : 'Contact Email'}</label>
                      <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Enter email" className={cn(inputCls, "h-10")} />
                    </div>
                    <div>
                      <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'সাপোর্ট ফোন' : 'Support Phone'}</label>
                      <Input value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} placeholder="Enter phone" className={cn(inputCls, "h-10")} />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'ঠিকানা' : 'Address'}</label>
                    <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Enter address" className={cn(inputCls, "h-10")} />
                  </div>
                </div>
                <div className="flex justify-end mt-8 pt-5 border-t border-white/[0.06]">
                  <button onClick={handleSaveProfile} disabled={saving}
                    className={cn("flex items-center gap-2 px-5 py-2.5 rounded-md text-[13px] font-medium transition-all duration-200",
                      isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800", saving && "opacity-60 cursor-not-allowed"
                    )}>
                    {saving ? <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Save className="h-4 w-4" />}
                    {isBn ? 'সংরক্ষণ করুন' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {/* Branding Tab — loading state while the form seeds */}
            {activeTab === "branding" && !brandForm && (
              <div className={`${card} p-6`}>
                <div className={`h-5 w-56 rounded-md ${isDark ? "bg-white/[0.06]" : "bg-zinc-200"}`} />
                <div className={`h-4 w-80 rounded mt-2 ${isDark ? "bg-white/[0.04]" : "bg-zinc-200/80"}`} />
                <div className={`h-20 w-full rounded-md mt-6 ${isDark ? "bg-white/[0.04]" : "bg-zinc-100"}`} />
                <div className={`h-32 w-full rounded-md mt-4 ${isDark ? "bg-white/[0.04]" : "bg-zinc-100"}`} />
              </div>
            )}

            {/* Branding Tab */}
            {activeTab === "branding" && brandForm && (
              <div className={`${card} p-6`}>
                <div className="mb-6">
                  <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'ব্র্যান্ডিং ও ল্যান্ডিং পেজ' : 'Branding & Landing Page'}</h2>
                  <p className={`text-sm mt-1 ${subtextCls}`}>{isBn ? 'লোগো, নাম, ল্যান্ডিং পেজের লেখা এবং সব পিডিএফের ওয়াটারমার্ক পরিবর্তন করুন' : 'Change the logo, names, landing-page text and the watermark shown in every PDF'}</p>
                </div>

                <div className="space-y-6">
                  {/* ── Logo ── */}
                  <div>
                    <label className={`block text-[13px] mb-2 font-medium ${labelCls}`}>{isBn ? 'লোগো' : 'Logo'}</label>
                    <div className="flex items-center gap-4">
                      <div className={cn("h-16 w-16 rounded-md flex items-center justify-center overflow-hidden shrink-0", isDark ? "bg-white/[0.04] border border-white/[0.08]" : "bg-zinc-50 border border-zinc-200")}>
                        {brandForm.brandLogo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={brandForm.brandLogo} alt="Logo" className="h-full w-full object-contain p-1" />
                        ) : (
                          <span className={`text-xs font-bold ${labelCls}`}>{BRANDING_DEFAULTS.brandShort}</span>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex gap-2">
                          <label className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium transition-all cursor-pointer",
                            isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
                            uploadKind === "logo" && "opacity-60 pointer-events-none")}>
                            <Upload className="h-4 w-4" />
                            {uploadKind === "logo" ? (isBn ? 'আপলোড হচ্ছে…' : 'Uploading…') : (isBn ? 'লোগো আপলোড' : 'Upload Logo')}
                            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploadKind === "logo"}
                              onChange={(e) => { handleBrandFile("logo", e.target.files?.[0]); e.target.value = ""; }} />
                          </label>
                          {brandForm.brandLogo && (
                            <button onClick={() => setBrandForm({ ...brandForm, brandLogo: "" })}
                              className={cn("px-4 py-2 rounded-md text-[13px] font-medium transition-all", isDark ? "text-zinc-400 hover:text-red-400" : "text-zinc-500 hover:text-red-600")}>
                              {isBn ? 'সরান' : 'Remove'}
                            </button>
                          )}
                        </div>
                        <p className={`text-[11px] ${subtextCls}`}>{isBn ? 'হেডার, ফুটার ও প্রবেশপত্রের ক্রেস্টে দেখানো হবে' : 'Shown in the landing header, footer and admit-card crest'}</p>
                      </div>
                    </div>
                  </div>

                  {/* ── Identity ── */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'শর্ট নাম' : 'Short Name'}</label>
                      <Input value={brandForm.brandShort} onChange={(e) => setBrandForm({ ...brandForm, brandShort: e.target.value })} placeholder={BRANDING_DEFAULTS.brandShort} className={cn(inputCls, "h-10")} />
                    </div>
                    <div>
                      <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>Association Name (English)</label>
                      <Input value={brandForm.brandName} onChange={(e) => setBrandForm({ ...brandForm, brandName: e.target.value })} placeholder={BRANDING_DEFAULTS.brandName} className={cn(inputCls, "h-10")} />
                    </div>
                    <div>
                      <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>Association Name (বাংলা)</label>
                      <Input value={brandForm.brandNameBn} onChange={(e) => setBrandForm({ ...brandForm, brandNameBn: e.target.value })} placeholder={BRANDING_DEFAULTS.brandNameBn} className={cn(inputCls, "h-10")} />
                    </div>
                  </div>

                  {/* ── Landing hero ── */}
                  <div className={`pt-5 border-t ${isDark ? "border-white/[0.06]" : "border-zinc-200"}`}>
                    <p className={`text-[13px] font-semibold mb-4 ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'ল্যান্ডিং পেজ — হিরো' : 'Landing Page — Hero'}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>Hero Title Line 1 (English)</label>
                        <Input value={brandForm.heroTitle1} onChange={(e) => setBrandForm({ ...brandForm, heroTitle1: e.target.value })} placeholder={t("hero.title1")} className={cn(inputCls, "h-10")} />
                      </div>
                      <div>
                        <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>শিরোনাম ১লাইন (বাংলা)</label>
                        <Input value={brandForm.heroTitle1Bn} onChange={(e) => setBrandForm({ ...brandForm, heroTitle1Bn: e.target.value })} placeholder={t("hero.title1")} className={cn(inputCls, "h-10")} />
                      </div>
                      <div>
                        <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>Hero Title Line 2 (English)</label>
                        <Input value={brandForm.heroTitle2} onChange={(e) => setBrandForm({ ...brandForm, heroTitle2: e.target.value })} placeholder={t("hero.title2")} className={cn(inputCls, "h-10")} />
                      </div>
                      <div>
                        <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>শিরোনাম ২লাইন (বাংলা)</label>
                        <Input value={brandForm.heroTitle2Bn} onChange={(e) => setBrandForm({ ...brandForm, heroTitle2Bn: e.target.value })} placeholder={t("hero.title2")} className={cn(inputCls, "h-10")} />
                      </div>
                      <div>
                        <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>Hero Subtitle (English)</label>
                        <textarea rows={3} value={brandForm.heroSubtitle} onChange={(e) => setBrandForm({ ...brandForm, heroSubtitle: e.target.value })} placeholder={t("hero.subtitle")}
                          className={cn(inputCls, "w-full rounded-md px-3 py-2.5 text-sm outline-none resize-none")} />
                      </div>
                      <div>
                        <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>সাবটাইটেল (বাংলা)</label>
                        <textarea rows={3} value={brandForm.heroSubtitleBn} onChange={(e) => setBrandForm({ ...brandForm, heroSubtitleBn: e.target.value })} placeholder={t("hero.subtitle")}
                          className={cn(inputCls, "w-full rounded-md px-3 py-2.5 text-sm outline-none resize-none")} />
                      </div>
                    </div>
                    <p className={`text-[11px] mt-2 ${subtextCls}`}>{isBn ? 'খালি রাখলে ডিফল্ট লেখা দেখাবে' : 'Leave empty to keep the default text'}</p>
                  </div>

                  {/* ── Footer tagline ── */}
                  <div className={`pt-5 border-t ${isDark ? "border-white/[0.06]" : "border-zinc-200"}`}>
                    <p className={`text-[13px] font-semibold mb-4 ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'ল্যান্ডিং পেজ — ফুটার' : 'Landing Page — Footer'}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>Footer Tagline (English)</label>
                        <textarea rows={3} value={brandForm.footerTagline} onChange={(e) => setBrandForm({ ...brandForm, footerTagline: e.target.value })} placeholder={t("footer.tagline")}
                          className={cn(inputCls, "w-full rounded-md px-3 py-2.5 text-sm outline-none resize-none")} />
                      </div>
                      <div>
                        <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>ফুটার ট্যাগলাইন (বাংলা)</label>
                        <textarea rows={3} value={brandForm.footerTaglineBn} onChange={(e) => setBrandForm({ ...brandForm, footerTaglineBn: e.target.value })} placeholder={t("footer.tagline")}
                          className={cn(inputCls, "w-full rounded-md px-3 py-2.5 text-sm outline-none resize-none")} />
                      </div>
                    </div>
                  </div>

                  {/* ── PDF watermark ── */}
                  <div className={`pt-5 border-t ${isDark ? "border-white/[0.06]" : "border-zinc-200"}`}>
                    <p className={`text-[13px] font-semibold mb-4 ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'সব পিডিএফের ওয়াটারমার্ক' : 'PDF Watermark (everywhere)'}</p>
                    <div className="flex items-center gap-4">
                      <div className={cn("h-16 w-24 rounded-md flex items-center justify-center overflow-hidden shrink-0", isDark ? "bg-white/[0.04] border border-white/[0.08]" : "bg-zinc-50 border border-zinc-200")}>
                        {brandForm.brandWatermark ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={brandForm.brandWatermark} alt="Watermark" className="h-full w-full object-contain p-1" />
                        ) : (
                          <span className={`text-[10px] font-semibold ${labelCls}`}>{brandForm.brandShort || BRANDING_DEFAULTS.brandShort}</span>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex gap-2">
                          <label className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium transition-all cursor-pointer",
                            isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
                            uploadKind === "watermark" && "opacity-60 pointer-events-none")}>
                            <Upload className="h-4 w-4" />
                            {uploadKind === "watermark" ? (isBn ? 'আপলোড হচ্ছে…' : 'Uploading…') : (isBn ? 'ওয়াটারমার্ক আপলোড' : 'Upload Watermark')}
                            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploadKind === "watermark"}
                              onChange={(e) => { handleBrandFile("watermark", e.target.files?.[0]); e.target.value = ""; }} />
                          </label>
                          {brandForm.brandWatermark && (
                            <button onClick={() => setBrandForm({ ...brandForm, brandWatermark: "" })}
                              className={cn("px-4 py-2 rounded-md text-[13px] font-medium transition-all", isDark ? "text-zinc-400 hover:text-red-400" : "text-zinc-500 hover:text-red-600")}>
                              {isBn ? 'সরান' : 'Remove'}
                            </button>
                          )}
                        </div>
                        <p className={`text-[11px] ${subtextCls}`}>{isBn ? 'প্রবেশপত্র ও সব পিডিএফে পেছনে দেখানো হবে — খালি রাখলে টেক্সট ওয়াটারমার্ক ব্যবহার হবে' : 'Appears behind admit cards and all PDFs — leave empty for the text watermark'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-8 pt-5 border-t border-white/[0.06]">
                  <button onClick={handleSaveBranding} disabled={saving || saveBranding.isPending}
                    className={cn("flex items-center gap-2 px-5 py-2.5 rounded-md text-[13px] font-medium transition-all duration-200",
                      isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800",
                      (saving || saveBranding.isPending) && "opacity-60 cursor-not-allowed"
                    )}>
                    {(saving || saveBranding.isPending) ? <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Save className="h-4 w-4" />}
                    {isBn ? 'সংরক্ষণ করুন' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {/* Account Tab */}
            {activeTab === "account" && (
              <div className={`${card} p-6`}>
                <div className="mb-6">
                  <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'অ্যাকাউন্ট তথ্য' : 'Account Information'}</h2>
                  <p className={`text-sm mt-1 ${subtextCls}`}>{isBn ? 'আপনার ব্যক্তিগত অ্যাকাউন্ট তথ্য পরিবর্তন করুন' : 'Update your personal account details'}</p>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'আপনার নাম' : 'Your Name'}</label>
                    <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Enter your name" className={cn(inputCls, "h-10")} />
                  </div>
                  <div>
                    <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'ইমেইল' : 'Email'}</label>
                    <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="Enter email" className={cn(inputCls, "h-10")} />
                  </div>
                </div>
                <div className="flex justify-end mt-8 pt-5 border-t border-white/[0.06]">
                  <button onClick={handleSaveAccount} disabled={saving}
                    className={cn("flex items-center gap-2 px-5 py-2.5 rounded-md text-[13px] font-medium transition-all duration-200",
                      isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800", saving && "opacity-60 cursor-not-allowed"
                    )}>
                    {saving ? <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Save className="h-4 w-4" />}
                    {isBn ? 'সংরক্ষণ করুন' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {/* Password Tab */}
            {activeTab === "password" && (
              <div className={`${card} p-6`}>
                <div className="mb-6">
                  <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'পাসওয়ার্ড পরিবর্তন' : 'Change Password'}</h2>
                  <p className={`text-sm mt-1 ${subtextCls}`}>{isBn ? 'আপনার অ্যাকাউন্টের পাসওয়ার্ড আপডেট করুন' : 'Update your account password'}</p>
                </div>
                <div className="max-w-md space-y-5">
                  <div>
                    <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'বর্তমান পাসওয়ার্ড' : 'Current Password'}</label>
                    <div className="relative">
                      <Input type={showCurrent ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" className={cn(inputCls, "h-10 pr-10")} />
                      <button type="button" onClick={() => setShowCurrent(!showCurrent)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? "text-zinc-500 hover:text-white" : "text-zinc-400 hover:text-zinc-600"}`}>
                        {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'নতুন পাসওয়ার্ড' : 'New Password'}</label>
                    <div className="relative">
                      <Input type={showNew ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" className={cn(inputCls, "h-10 pr-10")} />
                      <button type="button" onClick={() => setShowNew(!showNew)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? "text-zinc-500 hover:text-white" : "text-zinc-400 hover:text-zinc-600"}`}>
                        {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm Password'}</label>
                    <div className="relative">
                      <Input type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" className={cn(inputCls, "h-10 pr-10")} />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? "text-zinc-500 hover:text-white" : "text-zinc-400 hover:text-zinc-600"}`}>
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end mt-8 pt-5 border-t border-white/[0.06]">
                  <button onClick={handleChangePassword} disabled={saving || !currentPassword || !newPassword || !confirmPassword}
                    className={cn("flex items-center gap-2 px-5 py-2.5 rounded-md text-[13px] font-medium transition-all duration-200",
                      isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800",
                      (saving || !currentPassword || !newPassword || !confirmPassword) && "opacity-40 cursor-not-allowed"
                    )}>
                    {saving ? <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Lock className="h-4 w-4" />}
                    {isBn ? 'পাসওয়ার্ড পরিবর্তন করুন' : 'Change Password'}
                  </button>
                </div>
              </div>
            )}

            {/* Sessions Tab */}
            {activeTab === "sessions" && (
              <div className={`${card} p-6`}>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'একাডেমিক সেশন' : 'Academic Sessions'}</h2>
                    <p className={`text-sm mt-1 ${subtextCls}`}>{isBn ? 'সেশন পরিচালনা করুন এবং কারেন্ট সেশন পরিবর্তন করুন' : 'Manage sessions and switch the current active session'}</p>
                  </div>
                  <button onClick={() => setShowCreateSession(true)}
                    className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium transition-all duration-200",
                      isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800"
                    )}>
                    <Plus className="h-4 w-4" /> {isBn ? 'নতুন সেশন' : 'New Session'}
                  </button>
                </div>

                {showCreateSession && (
                  <div className={`mb-6 p-4 rounded-md border ${isDark ? "border-white/[0.08] bg-white/[0.02]" : "border-zinc-200 bg-zinc-50"}`}>
                    <h3 className={`text-sm font-medium mb-4 ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'নতুন সেশন তৈরি করুন' : 'Create New Session'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>Session Name</label>
                        <Input value={newSession.name} onChange={(e) => setNewSession({ ...newSession, name: e.target.value })} placeholder="2025-2026" className={cn(inputCls, "h-10")} />
                      </div>
                      <div>
                        <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>Code</label>
                        <Input value={newSession.code} onChange={(e) => setNewSession({ ...newSession, code: e.target.value })} placeholder="2025-26" className={cn(inputCls, "h-10")} />
                      </div>
                      <div>
                        <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>Start Date</label>
                        <Input type="date" value={newSession.startDate} onChange={(e) => setNewSession({ ...newSession, startDate: e.target.value })} className={cn(inputCls, "h-10")} />
                      </div>
                      <div>
                        <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>End Date</label>
                        <Input type="date" value={newSession.endDate} onChange={(e) => setNewSession({ ...newSession, endDate: e.target.value })} className={cn(inputCls, "h-10")} />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <button onClick={() => setShowCreateSession(false)} className={cn("px-4 py-2 rounded-md text-[13px] font-medium transition-all", isDark ? "text-zinc-400 hover:text-white" : "text-zinc-600 hover:text-zinc-900")}>
                        {isBn ? 'বাতিল' : 'Cancel'}
                      </button>
                      <button onClick={async () => {
                        if (!newSession.name || !newSession.code) { toast("error", "Name and code required"); return; }
                        try {
                          await createSession.mutateAsync({ name: newSession.name, code: newSession.code, startDate: newSession.startDate, endDate: newSession.endDate, isActive: true, isCurrent: sessions.length === 0 });
                          setNewSession({ name: "", code: "", startDate: "", endDate: "" });
                          setShowCreateSession(false);
                          toast("success", isBn ? "সেশন তৈরি হয়েছে!" : "Session created!");
                        } catch (err: any) { toast("error", err.message || "Failed"); }
                      }} disabled={!newSession.name || !newSession.code}
                        className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium transition-all",
                          isDark ? "bg-white text-black" : "bg-zinc-900 text-white", (!newSession.name || !newSession.code) && "opacity-40 cursor-not-allowed"
                        )}>
                        <Check className="h-4 w-4" /> {isBn ? 'তৈরি করুন' : 'Create'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {sessions.length === 0 ? (
                    <p className={`text-sm py-8 text-center ${subtextCls}`}>{isBn ? 'কোনো সেশন নেই।' : 'No sessions yet.'}</p>
                  ) : sessions.map((session) => (
                    <div key={session.id} className={cn("flex items-center justify-between p-4 rounded-md border transition-all",
                      session.isCurrent ? isDark ? "border-white/20 bg-white/[0.04]" : "border-zinc-400 bg-zinc-100"
                        : isDark ? "border-white/[0.06] bg-white/[0.02]" : "border-zinc-200 bg-white"
                    )}>
                      <div className="flex items-center gap-4">
                        <div className={cn("h-10 w-10 rounded-md flex items-center justify-center",
                          session.isCurrent ? isDark ? "bg-white/10" : "bg-zinc-900/10" : isDark ? "bg-white/[0.04]" : "bg-zinc-100"
                        )}>
                          <Calendar className={cn("h-5 w-5", session.isCurrent ? isDark ? "text-white" : "text-zinc-900" : isDark ? "text-zinc-500" : "text-zinc-400")} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{session.name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? "bg-white/[0.06] text-zinc-400" : "bg-zinc-100 text-zinc-500"}`}>{session.code}</span>
                            {session.isCurrent && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">{isBn ? 'কারেন্ট' : 'Current'}</span>}
                            {!session.isActive && <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-500/10 text-zinc-500">{isBn ? 'নিষ্ক্রিয়' : 'Inactive'}</span>}
                          </div>
                          <p className={`text-xs mt-0.5 ${subtextCls}`}>{session.startDate} → {session.endDate}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!session.isCurrent && (
                          <button onClick={() => setCurrentSession.mutate(session.id)}
                            className={cn("px-3 py-1.5 rounded-md text-[12px] font-medium transition-all", isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-zinc-900/10 text-zinc-900 hover:bg-zinc-900/20")}>
                            {isBn ? 'কারেন্ট' : 'Set Current'}
                          </button>
                        )}
                        <button onClick={() => updateSession.mutate({ id: session.id, data: { isActive: !session.isActive } })}
                          className={cn("px-3 py-1.5 rounded-md text-[12px] font-medium transition-all",
                            session.isActive ? isDark ? "text-zinc-500 hover:text-white" : "text-zinc-400 hover:text-zinc-900" : "text-emerald-500 hover:text-emerald-400"
                          )}>
                          {session.isActive ? (isBn ? 'নিষ্ক্রিয়' : 'Deactivate') : (isBn ? 'সক্রিয়' : 'Activate')}
                        </button>
                        <button onClick={() => { if (confirm(`Delete "${session.name}"?`)) deleteSession.mutate(session.id, {
                          onError: (err) => {
                            const msg = String((err as Error)?.message || '');
                            if (msg.startsWith('SESSION_HAS_DATA')) {
                              const count = msg.split(':')[1] || '0';
                              toast("error", isBn
                                ? `এই সেশনে ${count} টি রেকর্ড আছে — মুছে ফেললে পুরোনো ডেটা স্থায়ীভাবে নষ্ট হবে`
                                : `This session still has ${count} records — deleting it would permanently wipe the data`);
                            } else {
                              toast("error", isBn ? 'সেশন মোছা যায়নি' : 'Could not delete session');
                            }
                          },
                        }); }}
                          className="p-1.5 rounded-md text-red-500 hover:bg-red-500/10 transition-all">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Tab */}
            {activeTab === "payment" && (
              <div className={`${card} p-6`}>
                <div className="mb-6">
                  <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'পেমেন্ট নির্দেশনা' : 'Payment Instructions'}</h2>
                  <p className={`text-sm mt-1 ${subtextCls}`}>{isBn ? 'নিবন্ধনের টাকা পাঠানোর তথ্য — প্রতিষ্ঠানগুলো পেমেন্ট পেজে এটি দেখবে' : 'Where institutions send registration money — shown on their Payments page'}</p>
                </div>
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'bKash নম্বর' : 'bKash Number'}</label>
                      <Input value={paymentBkashNumber} onChange={(e) => setPaymentBkashNumber(e.target.value)} placeholder="01XXXXXXXXX" className={cn(inputCls, "h-10")} />
                    </div>
                    <div>
                      <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'অ্যাকাউন্টের নাম' : 'Account Name'}</label>
                      <Input value={paymentBkashName} onChange={(e) => setPaymentBkashName(e.target.value)} placeholder={isBn ? 'অ্যাকাউন্ট হোল্ডারের নাম' : 'Account holder name'} className={cn(inputCls, "h-10")} />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'নগদ পরিশোধের ঠিকানা (ঐচ্ছিক)' : 'Cash Payment Address (optional)'}</label>
                    <Input value={paymentCashAddress} onChange={(e) => setPaymentCashAddress(e.target.value)} placeholder={isBn ? 'অফিসের ঠিকানা' : 'Office address for cash payments'} className={cn(inputCls, "h-10")} />
                  </div>
                  <div>
                    <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>{isBn ? 'পেমেন্ট নির্দেশনা (ঐচ্ছিক)' : 'Payment Instructions (optional)'}</label>
                    <textarea
                      rows={5}
                      value={paymentInstructions}
                      onChange={(e) => setPaymentInstructions(e.target.value)}
                      placeholder={isBn ? 'প্রতি ধাপে পেমেন্ট করার নির্দেশনা লিখুন...' : 'Step-by-step instructions for sending the money...'}
                      className={cn(inputCls, "w-full rounded-md px-3 py-2.5 text-sm outline-none resize-none")}
                    />
                    <p className={`text-[11px] mt-1.5 ${subtextCls}`}>{isBn ? 'লাইন বিরতিসহ লিখুন — প্রতিষ্ঠানের পেমেন্ট পেজে এমনিই দেখানো হবে' : 'Line breaks are preserved — shown as-is on the institution payments page'}</p>
                  </div>
                </div>
                <div className="flex justify-end mt-8 pt-5 border-t border-white/[0.06]">
                  <button onClick={handleSavePayment} disabled={saving}
                    className={cn("flex items-center gap-2 px-5 py-2.5 rounded-md text-[13px] font-medium transition-all duration-200",
                      isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800", saving && "opacity-60 cursor-not-allowed"
                    )}>
                    {saving ? <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Save className="h-4 w-4" />}
                    {isBn ? 'সংরক্ষণ করুন' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === "notifications" && (
              <div className={`${card} p-6`}>
                <div className="mb-6">
                  <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'বিজ্ঞপ্তি সেটিংস' : 'Notification Settings'}</h2>
                  <p className={`text-sm mt-1 ${subtextCls}`}>{isBn ? 'কোন বিজ্ঞপ্তি পেতে চান তা নির্বাচন করুন' : 'Choose which notifications you want to receive'}</p>
                </div>
                <div className="space-y-1">
                  {[
                    { label: "ইমেইল বিজ্ঞপ্তি", labelEn: "Email Notifications", value: emailNotifications, setter: setEmailNotifications },
                    { label: "নিবন্ধন সতর্কতা", labelEn: "Registration Alerts", value: registrationAlerts, setter: setRegistrationAlerts },
                    { label: "ফলাফল সতর্কতা", labelEn: "Result Alerts", value: resultAlerts, setter: setResultAlerts },
                    { label: "পেমেন্ট সতর্কতা", labelEn: "Payment Alerts", value: paymentAlerts, setter: setPaymentAlerts },
                  ].map((item, i) => (
                    <div key={i} className={`flex items-center justify-between py-4 px-4 rounded-md transition-colors ${i > 0 ? `border-t ${isDark ? "border-white/[0.04]" : "border-zinc-100"}` : ""}`}>
                      <div>
                        <p className={`text-sm font-medium ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{isBn ? item.label : item.labelEn}</p>
                      </div>
                      <button onClick={() => item.setter(!item.value)}
                        className={cn("relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200",
                          item.value ? isDark ? "bg-white" : "bg-zinc-900" : isDark ? "bg-white/20" : "bg-zinc-300"
                        )}>
                        <span className={cn("pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition duration-200",
                          item.value ? "translate-x-4" : "translate-x-0.5"
                        )} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-8 pt-5 border-t border-white/[0.06]">
                  <button onClick={handleSaveNotifications} disabled={saving}
                    className={cn("flex items-center gap-2 px-5 py-2.5 rounded-md text-[13px] font-medium transition-all duration-200",
                      isDark ? "bg-white text-black hover:bg-white/90" : "bg-zinc-900 text-white hover:bg-zinc-800", saving && "opacity-60 cursor-not-allowed"
                    )}>
                    {saving ? <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Save className="h-4 w-4" />}
                    {isBn ? 'সংরক্ষণ করুন' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-zinc-200 border border-zinc-300 shadow-sm";
  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="mb-8">
          <div className={`h-8 w-48 rounded-md ${isDark ? 'bg-white/[0.06]' : 'bg-zinc-300'}`} />
          <div className={`h-4 w-64 rounded mt-2 ${isDark ? 'bg-white/[0.04]' : 'bg-zinc-300/80'}`} />
        </div>
        <div className="flex gap-6">
          <div className={`${card} w-56 h-48 rounded-md`} />
          <div className={`flex-1 ${card} rounded-md h-96`} />
        </div>
      </div>
    </div>
  );
}
