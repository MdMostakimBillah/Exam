"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { getInstitutionBySlug, updateInstitution } from "@/lib/storage/institutions";
import { updateUser } from "@/lib/storage/users";
import { getCurrentUser } from "@/lib/auth/auth";
import { Settings, Building2, User, Lock, Bell, Save, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { cn } from "@/lib/utils/helpers";

type Tab = "profile" | "account" | "password" | "notifications";

export default function InstitutionSettingsPage() {
  const params = useParams();
  const slug = params.institutionSlug as string;
  const { toast } = useToast();
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [saving, setSaving] = useState(false);

  // Profile fields
  const [instName, setInstName] = useState("");
  const [instEmail, setInstEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");

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
  const [registrationUpdates, setRegistrationUpdates] = useState(true);
  const [resultPublications, setResultPublications] = useState(true);
  const [paymentAlerts, setPaymentAlerts] = useState(true);

  useEffect(() => {
    setMounted(true);
    const inst = getInstitutionBySlug(slug);
    if (inst) {
      setInstName(inst.name);
      setInstEmail(inst.email);
      setPhone(inst.phone);
      setAddress(inst.address);
      setContactPerson(inst.contactPerson);
      setCity(inst.city);
      setDistrict(inst.district);
    }
    const currentUser = getCurrentUser();
    if (currentUser) {
      setAdminName(currentUser.name);
      setAdminEmail(currentUser.email);
    }
  }, [slug]);

  const handleSaveProfile = async () => {
    setSaving(true);
    const inst = getInstitutionBySlug(slug);
    if (inst) {
      updateInstitution(inst.id, {
        name: instName,
        email: instEmail,
        phone,
        address,
        contactPerson,
        city,
        district,
      });
    }
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    toast("success", isBn ? "প্রোফাইল সফলভাবে সংরক্ষিত হয়েছে!" : "Profile saved successfully!");
  };

  const handleSaveAccount = async () => {
    setSaving(true);
    const currentUser = getCurrentUser();
    if (currentUser) {
      updateUser(currentUser.id, { name: adminName, email: adminEmail });
    }
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
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.password !== currentPassword) {
      toast("error", isBn ? "বর্তমান পাসওয়ার্ড সঠিক নয়" : "Current password is incorrect");
      return;
    }
    setSaving(true);
    if (currentUser) {
      updateUser(currentUser.id, { password: newPassword });
    }
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast("success", isBn ? "পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!" : "Password changed successfully!");
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    toast("success", isBn ? "বিজ্ঞপ্তি সেটিংস সংরক্ষিত হয়েছে!" : "Notification settings saved!");
  };

  if (!mounted) return <SettingsSkeleton isDark={isDark} />;

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-2xl"
    : "bg-white border border-zinc-200 rounded-2xl shadow-sm";

  const tabs: { id: Tab; label: string; labelBn: string; icon: React.ReactNode }[] = [
    { id: "profile", label: "Profile", labelBn: "প্রোফাইল", icon: <Building2 className="h-4 w-4" /> },
    { id: "account", label: "Account", labelBn: "অ্যাকাউন্ট", icon: <User className="h-4 w-4" /> },
    { id: "password", label: "Password", labelBn: "পাসওয়ার্ড", icon: <Lock className="h-4 w-4" /> },
    { id: "notifications", label: "Notifications", labelBn: "বিজ্ঞপ্তি", icon: <Bell className="h-4 w-4" /> },
  ];

  const inputCls = isDark
    ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-white/10"
    : "bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-zinc-200";

  const labelCls = isDark ? "text-zinc-400" : "text-zinc-600";
  const subtextCls = isDark ? "text-zinc-500" : "text-zinc-500";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? 'সেটিংস' : 'Settings'}
          </h1>
          <p className={`text-sm mt-1 ${subtextCls}`}>
            {isBn ? 'প্রতিষ্ঠানের সেটিংস এবং পছন্দ কনফিগার করুন' : 'Configure institution settings and preferences'}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Tabs */}
          <div className="lg:w-56 shrink-0">
            <div className={`${card} p-2`}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm transition-all duration-200",
                    activeTab === tab.id
                      ? isDark
                        ? "bg-white text-black font-medium"
                        : "bg-zinc-900 text-white font-medium"
                      : isDark
                        ? "text-zinc-500 hover:text-white hover:bg-white/[0.05]"
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                  )}
                >
                  {tab.icon}
                  {isBn ? tab.labelBn : tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Profile Tab */}
            {activeTab === "profile" && (
              <div className={`${card} p-6`}>
                <div className="mb-6">
                  <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                    {isBn ? 'প্রতিষ্ঠানের তথ্য' : 'Institution Information'}
                  </h2>
                  <p className={`text-sm mt-1 ${subtextCls}`}>
                    {isBn ? 'আপনার প্রতিষ্ঠানের মৌলিক তথ্য আপডেট করুন' : 'Update your institution details'}
                  </p>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>
                      {isBn ? 'প্রতিষ্ঠানের নাম' : 'Institution Name'}
                    </label>
                    <Input
                      value={instName}
                      onChange={(e) => setInstName(e.target.value)}
                      placeholder={isBn ? 'প্রতিষ্ঠানের নাম লিখুন' : 'Enter institution name'}
                      className={cn(inputCls, "h-10")}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>
                        {isBn ? 'ইমেইল' : 'Email'}
                      </label>
                      <Input
                        type="email"
                        value={instEmail}
                        onChange={(e) => setInstEmail(e.target.value)}
                        placeholder={isBn ? 'ইমেইল লিখুন' : 'Enter email'}
                        className={cn(inputCls, "h-10")}
                      />
                    </div>
                    <div>
                      <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>
                        {isBn ? 'ফোন' : 'Phone'}
                      </label>
                      <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder={isBn ? 'ফোন নম্বর লিখুন' : 'Enter phone number'}
                        className={cn(inputCls, "h-10")}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>
                      {isBn ? 'ঠিকানা' : 'Address'}
                    </label>
                    <Input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder={isBn ? 'পূর্ণ ঠিকানা লিখুন' : 'Enter full address'}
                      className={cn(inputCls, "h-10")}
                    />
                  </div>

                  <div>
                    <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>
                      {isBn ? 'যোগাযোগ ব্যক্তি' : 'Contact Person'}
                    </label>
                    <Input
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      placeholder={isBn ? 'যোগাযোগ ব্যক্তির নাম' : 'Contact person name'}
                      className={cn(inputCls, "h-10")}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>
                        {isBn ? 'শহর' : 'City'}
                      </label>
                      <Input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder={isBn ? 'শহরের নাম' : 'City name'}
                        className={cn(inputCls, "h-10")}
                      />
                    </div>
                    <div>
                      <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>
                        {isBn ? 'জেলা' : 'District'}
                      </label>
                      <Input
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        placeholder={isBn ? 'জেলার নাম' : 'District name'}
                        className={cn(inputCls, "h-10")}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-8 pt-5 border-t border-white/[0.06]">
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className={cn(
                      "flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200",
                      isDark
                        ? "bg-white text-black hover:bg-white/90"
                        : "bg-zinc-900 text-white hover:bg-zinc-800",
                      saving && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    {saving ? (
                      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {isBn ? 'সংরক্ষণ করুন' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {/* Account Tab */}
            {activeTab === "account" && (
              <div className={`${card} p-6`}>
                <div className="mb-6">
                  <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                    {isBn ? 'অ্যাকাউন্ট তথ্য' : 'Account Information'}
                  </h2>
                  <p className={`text-sm mt-1 ${subtextCls}`}>
                    {isBn ? 'আপনার ব্যক্তিগত অ্যাকাউন্ট তথ্য পরিবর্তন করুন' : 'Update your personal account details'}
                  </p>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>
                      {isBn ? 'আপনার নাম' : 'Your Name'}
                    </label>
                    <Input
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder={isBn ? 'নাম লিখুন' : 'Enter your name'}
                      className={cn(inputCls, "h-10")}
                    />
                  </div>
                  <div>
                    <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>
                      {isBn ? 'ইমেইল' : 'Email'}
                    </label>
                    <Input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder={isBn ? 'ইমেইল লিখুন' : 'Enter email'}
                      className={cn(inputCls, "h-10")}
                    />
                  </div>
                </div>

                <div className="flex justify-end mt-8 pt-5 border-t border-white/[0.06]">
                  <button
                    onClick={handleSaveAccount}
                    disabled={saving}
                    className={cn(
                      "flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200",
                      isDark
                        ? "bg-white text-black hover:bg-white/90"
                        : "bg-zinc-900 text-white hover:bg-zinc-800",
                      saving && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    {saving ? (
                      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {isBn ? 'সংরক্ষণ করুন' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {/* Password Tab */}
            {activeTab === "password" && (
              <div className={`${card} p-6`}>
                <div className="mb-6">
                  <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                    {isBn ? 'পাসওয়ার্ড পরিবর্তন' : 'Change Password'}
                  </h2>
                  <p className={`text-sm mt-1 ${subtextCls}`}>
                    {isBn ? 'আপনার অ্যাকাউন্টের পাসওয়ার্ড আপডেট করুন' : 'Update your account password'}
                  </p>
                </div>

                <div className="max-w-md space-y-5">
                  <div>
                    <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>
                      {isBn ? 'বর্তমান পাসওয়ার্ড' : 'Current Password'}
                    </label>
                    <div className="relative">
                      <Input
                        type={showCurrent ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder={isBn ? 'বর্তমান পাসওয়ার্ড লিখুন' : 'Enter current password'}
                        className={cn(inputCls, "h-10 pr-10")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrent(!showCurrent)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? "text-zinc-500 hover:text-white" : "text-zinc-400 hover:text-zinc-600"}`}
                      >
                        {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>
                      {isBn ? 'নতুন পাসওয়ার্ড' : 'New Password'}
                    </label>
                    <div className="relative">
                      <Input
                        type={showNew ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={isBn ? 'নতুন পাসওয়ার্ড লিখুন' : 'Enter new password'}
                        className={cn(inputCls, "h-10 pr-10")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? "text-zinc-500 hover:text-white" : "text-zinc-400 hover:text-zinc-600"}`}
                      >
                        {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {newPassword && newPassword.length < 6 && (
                      <p className="text-amber-500 text-xs mt-1.5">
                        {isBn ? 'কমপক্ষে ৬ অক্ষর প্রয়োজন' : 'At least 6 characters required'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className={`block text-[13px] mb-1.5 font-medium ${labelCls}`}>
                      {isBn ? 'পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm Password'}
                    </label>
                    <div className="relative">
                      <Input
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={isBn ? 'পাসওয়ার্ড আবার লিখুন' : 'Re-enter new password'}
                        className={cn(inputCls, "h-10 pr-10")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? "text-zinc-500 hover:text-white" : "text-zinc-400 hover:text-zinc-600"}`}
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-amber-500 text-xs mt-1.5">
                        {isBn ? 'পাসওয়ার্ড মিলছে না' : 'Passwords do not match'}
                      </p>
                    )}
                    {confirmPassword && newPassword === confirmPassword && confirmPassword.length >= 6 && (
                      <p className="text-emerald-500 text-xs mt-1.5 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {isBn ? 'পাসওয়ার্ড মিলেছে' : 'Passwords match'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end mt-8 pt-5 border-t border-white/[0.06]">
                  <button
                    onClick={handleChangePassword}
                    disabled={saving || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 6}
                    className={cn(
                      "flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200",
                      isDark
                        ? "bg-white text-black hover:bg-white/90"
                        : "bg-zinc-900 text-white hover:bg-zinc-800",
                      (saving || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 6) && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    {saving ? (
                      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                    {isBn ? 'পাসওয়ার্ড পরিবর্তন করুন' : 'Change Password'}
                  </button>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === "notifications" && (
              <div className={`${card} p-6`}>
                <div className="mb-6">
                  <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                    {isBn ? 'বিজ্ঞপ্তি সেটিংস' : 'Notification Settings'}
                  </h2>
                  <p className={`text-sm mt-1 ${subtextCls}`}>
                    {isBn ? 'কোন বিজ্ঞপ্তি পেতে চান তা নির্বাচন করুন' : 'Choose which notifications you want to receive'}
                  </p>
                </div>

                <div className="space-y-1">
                  {[
                    { label: "ইমেইল বিজ্ঞপ্তি", labelEn: "Email Notifications", desc: "গুরুত্বপূর্ণ ইভেন্টের জন্য ইমেইল আপডেট পান", descEn: "Receive email updates for important events", value: emailNotifications, setter: setEmailNotifications },
                    { label: "নিবন্ধন আপডেট", labelEn: "Registration Updates", desc: "নিবন্ধন অনুমোদিত হলে বিজ্ঞপ্তি দিন", descEn: "Notify when registrations are approved", value: registrationUpdates, setter: setRegistrationUpdates },
                    { label: "ফলাফল প্রকাশ", labelEn: "Result Publications", desc: "ফলাফল প্রকাশিত হলে বিজ্ঞপ্তি দিন", descEn: "Notify when results are published", value: resultPublications, setter: setResultPublications },
                    { label: "পেমেন্ট সতর্কতা", labelEn: "Payment Alerts", desc: "পেমেন্ট সম্পন্ন হলে বিজ্ঞপ্তি দিন", descEn: "Notify when payments are received", value: paymentAlerts, setter: setPaymentAlerts },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between py-4 px-4 rounded-xl transition-colors ${
                        i === 0 ? "" : `border-t ${isDark ? "border-white/[0.04]" : "border-zinc-100"}`
                      }`}
                    >
                      <div>
                        <p className={`text-sm font-medium ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                          {isBn ? item.label : item.labelEn}
                        </p>
                        <p className={`text-xs mt-0.5 ${subtextCls}`}>
                          {isBn ? item.desc : item.descEn}
                        </p>
                      </div>
                      <button
                        onClick={() => item.setter(!item.value)}
                        className={cn(
                          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200",
                          item.value
                            ? isDark ? "bg-white" : "bg-zinc-900"
                            : isDark ? "bg-white/20" : "bg-zinc-300"
                        )}
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition duration-200",
                            item.value
                              ? isDark ? "translate-x-4 bg-black" : "translate-x-4"
                              : "translate-x-0.5"
                          )}
                        />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end mt-8 pt-5 border-t border-white/[0.06]">
                  <button
                    onClick={handleSaveNotifications}
                    disabled={saving}
                    className={cn(
                      "flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200",
                      isDark
                        ? "bg-white text-black hover:bg-white/90"
                        : "bg-zinc-900 text-white hover:bg-zinc-800",
                      saving && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    {saving ? (
                      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
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
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="mb-8">
          <div className={`h-8 w-48 rounded-lg ${isDark ? 'bg-white/[0.06]' : 'bg-zinc-200'}`} />
          <div className={`h-4 w-64 rounded mt-2 ${isDark ? 'bg-white/[0.04]' : 'bg-zinc-200/60'}`} />
        </div>
        <div className="flex gap-6">
          <div className={`${card} w-56 h-48 rounded-2xl`} />
          <div className={`flex-1 ${card} rounded-2xl h-96`} />
        </div>
      </div>
    </div>
  );
}
