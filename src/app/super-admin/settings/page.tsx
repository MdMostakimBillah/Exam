"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { Settings, Globe, Bell, Shield, FileText, Save } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

export default function SettingsPage() {
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const { toast } = useToast();
  const [platformName, setPlatformName] = useState("Bangladesh Education Society");
  const [tagline, setTagline] = useState("Scholarship Examination Management Platform");
  const [supportEmail, setSupportEmail] = useState("support@scholarx.local");
  const [contactPhone, setContactPhone] = useState("+880-2-XXXXXXXX");

  const handleSave = () => {
    toast("success", "Settings saved successfully!");
  };

  const card = isDark ? "bg-[#141416] border border-white/[0.06] rounded-2xl" : "bg-white border border-zinc-200 rounded-2xl shadow-sm";
  const iconBg = isDark ? "bg-white/[0.08]" : "bg-zinc-100";
  const iconColor = isDark ? "text-zinc-300" : "text-zinc-600";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? 'সেটিংস' : 'Settings'}
          </h1>
          <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            {isBn ? 'প্ল্যাটফর্ম পছন্দ কনফিগার করুন' : 'Configure platform preferences'}
          </p>
        </div>
        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[
            { label: isBn ? 'প্ল্যাটফর্ম' : 'Platform', value: platformName.split(' ').slice(0, 2).join(' ') },
            { label: isBn ? 'ইমেইল' : 'Email', value: supportEmail },
            { label: isBn ? 'ফোন' : 'Phone', value: contactPhone },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                <Settings className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold tracking-tight leading-tight truncate ${isDark ? "text-white" : "text-zinc-900"}`}>{s.value}</p>
                <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="general">
          <div className={`${card} p-1 mb-6`}>
            <TabsList>
              <TabsTrigger value="general"><Globe className="h-3.5 w-3.5 mr-1.5" /> {isBn ? 'সাধারণ' : 'General'}</TabsTrigger>
              <TabsTrigger value="exam"><FileText className="h-3.5 w-3.5 mr-1.5" /> {isBn ? 'পরীক্ষা' : 'Exam'}</TabsTrigger>
              <TabsTrigger value="certificate"><Shield className="h-3.5 w-3.5 mr-1.5" /> {isBn ? 'সার্টিফিকেট' : 'Certificate'}</TabsTrigger>
              <TabsTrigger value="notifications"><Bell className="h-3.5 w-3.5 mr-1.5" /> {isBn ? 'বিজ্ঞপ্তি' : 'Notifications'}</TabsTrigger>
              <TabsTrigger value="security"><Shield className="h-3.5 w-3.5 mr-1.5" /> {isBn ? 'নিরাপত্তা' : 'Security'}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="general">
            <div className={`${card} p-5`}>
              <div className="flex items-center gap-2 mb-5">
                <Globe className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'প্ল্যাটফর্ম পরিচয়' : 'Platform Identity'}</h3>
              </div>
              <div className="space-y-4 max-w-lg">
                <div>
                  <label className={`text-[11px] font-medium block mb-1.5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? 'প্ল্যাটফর্মের নাম' : 'Platform Name'}</label>
                  <Input value={platformName} onChange={(e) => setPlatformName(e.target.value)} className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
                </div>
                <div>
                  <label className={`text-[11px] font-medium block mb-1.5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? 'ট্যাগলাইন' : 'Tagline'}</label>
                  <Input value={tagline} onChange={(e) => setTagline(e.target.value)} className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
                </div>
                <div>
                  <label className={`text-[11px] font-medium block mb-1.5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? 'সাপোর্ট ইমেইল' : 'Support Email'}</label>
                  <Input type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
                </div>
                <div>
                  <label className={`text-[11px] font-medium block mb-1.5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? 'যোগাযোগ ফোন' : 'Contact Phone'}</label>
                  <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
                </div>
                <button onClick={handleSave} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-medium transition-colors ${isDark ? "bg-white/[0.08] text-white hover:bg-white/[0.12]" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
                  <Save className="h-3.5 w-3.5" /> {isBn ? 'সংরক্ষণ করুন' : 'Save Changes'}
                </button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="exam">
            <div className={`${card} p-5`}>
              <div className="flex items-center gap-2 mb-5">
                <FileText className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'পরীক্ষা সেটিংস' : 'Examination Settings'}</h3>
              </div>
              <div className="space-y-4 max-w-lg">
                <div>
                  <label className={`text-[11px] font-medium block mb-1.5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? 'ডিফল্ট নিবন্ধন ফি (৳)' : 'Default Registration Fee (৳)'}</label>
                  <Input type="number" defaultValue="100" className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
                </div>
                <div>
                  <label className={`text-[11px] font-medium block mb-1.5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? 'বিলম্ব ফি (৳)' : 'Late Fee (৳)'}</label>
                  <Input type="number" defaultValue="50" className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
                </div>
                <div>
                  <label className={`text-[11px] font-medium block mb-1.5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? 'পাস মার্ক (%)' : 'Pass Mark Percentage'}</label>
                  <Input type="number" defaultValue="33" className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
                </div>
                <div>
                  <label className={`text-[11px] font-medium block mb-1.5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? 'বৃত্তি যোগ্যতা (%)' : 'Scholarship Eligibility Percentage'}</label>
                  <Input type="number" defaultValue="75" className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
                </div>
                <button onClick={handleSave} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-medium transition-colors ${isDark ? "bg-white/[0.08] text-white hover:bg-white/[0.12]" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
                  <Save className="h-3.5 w-3.5" /> {isBn ? 'সংরক্ষণ করুন' : 'Save Changes'}
                </button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="certificate">
            <div className={`${card} p-5`}>
              <div className="flex items-center gap-2 mb-5">
                <Shield className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'সার্টিফিকেট সেটিংস' : 'Certificate Settings'}</h3>
              </div>
              <div className="space-y-4 max-w-lg">
                <div>
                  <label className={`text-[11px] font-medium block mb-1.5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? 'সার্টিফিকেট প্রিফিক্স' : 'Certificate Prefix'}</label>
                  <Input defaultValue="SCX" className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
                </div>
                <div>
                  <label className={`text-[11px] font-medium block mb-1.5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? 'সংস্থার নাম' : 'Organization Name'}</label>
                  <Input defaultValue="Bangladesh Education Society" className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
                </div>
                <div>
                  <label className={`text-[11px] font-medium block mb-1.5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? 'স্বাক্ষরকারীর নাম' : 'Signature Name'}</label>
                  <Input defaultValue="Chairman" className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
                </div>
                <button onClick={handleSave} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-medium transition-colors ${isDark ? "bg-white/[0.08] text-white hover:bg-white/[0.12]" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
                  <Save className="h-3.5 w-3.5" /> {isBn ? 'সংরক্ষণ করুন' : 'Save Changes'}
                </button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications">
            <div className={`${card} p-5`}>
              <div className="flex items-center gap-2 mb-5">
                <Bell className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'বিজ্ঞপ্তি সেটিংস' : 'Notification Settings'}</h3>
              </div>
              <div className="space-y-4 max-w-lg">
                {[
                  { label: isBn ? 'ইমেইল বিজ্ঞপ্তি' : 'Email Notifications', desc: isBn ? 'গুরুত্বপূর্ণ ইভেন্টে ইমেইল আপডেট পান' : 'Receive email updates for important events', defaultChecked: true },
                  { label: isBn ? 'নিবন্ধন সতর্কতা' : 'Registration Alerts', desc: isBn ? 'নতুন নিবন্ধন জমা হলে সতর্ক করুন' : 'Notify when new registrations are submitted', defaultChecked: true },
                  { label: isBn ? 'ফলাফল প্রকাশ' : 'Result Publications', desc: isBn ? 'ফলাফল প্রকাশিত হলে সতর্ক করুন' : 'Notify when results are published', defaultChecked: true },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-white/[0.04] dark:border-white/[0.04] last:border-0">
                    <div>
                      <p className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>{item.label}</p>
                      <p className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{item.desc}</p>
                    </div>
                    <input type="checkbox" className="h-4 w-4 rounded" defaultChecked={item.defaultChecked} />
                  </div>
                ))}
                <button onClick={handleSave} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-medium transition-colors mt-2 ${isDark ? "bg-white/[0.08] text-white hover:bg-white/[0.12]" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
                  <Save className="h-3.5 w-3.5" /> {isBn ? 'সংরক্ষণ করুন' : 'Save Changes'}
                </button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="security">
            <div className={`${card} p-5`}>
              <div className="flex items-center gap-2 mb-5">
                <Shield className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'নিরাপত্তা সেটিংস' : 'Security Settings'}</h3>
              </div>
              <div className="space-y-4 max-w-lg">
                <div>
                  <label className={`text-[11px] font-medium block mb-1.5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? 'সেশন টাইমআউট (মিনিট)' : 'Session Timeout (minutes)'}</label>
                  <Input type="number" defaultValue="30" className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"} />
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/[0.04] dark:border-white/[0.04]">
                  <div>
                    <p className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>{isBn ? 'দ্বি-ফ্যাক্টর অথেনটিকেশন' : 'Two-Factor Authentication'}</p>
                    <p className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? 'অ্যাডমিন অ্যাকাউন্টের জন্য 2FA প্রয়োজন' : 'Require 2FA for admin accounts'}</p>
                  </div>
                  <input type="checkbox" className="h-4 w-4 rounded" />
                </div>
                <button onClick={handleSave} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-medium transition-colors mt-2 ${isDark ? "bg-white/[0.08] text-white hover:bg-white/[0.12]" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
                  <Save className="h-3.5 w-3.5" /> {isBn ? 'সংরক্ষণ করুন' : 'Save Changes'}
                </button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
