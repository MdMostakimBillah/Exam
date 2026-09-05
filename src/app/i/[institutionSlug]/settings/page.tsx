"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { getInstitutionBySlug } from "@/lib/storage/institutions";
import { Settings, Building2, Bell, Save } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

export default function InstitutionSettingsPage() {
  const params = useParams();
  const slug = params.institutionSlug as string;
  const { toast } = useToast();
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const [mounted, setMounted] = useState(false);
  const [instName, setInstName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [contactPerson, setContactPerson] = useState("");

  useEffect(() => {
    setMounted(true);
    const inst = getInstitutionBySlug(slug);
    if (inst) {
      setInstName(inst.name);
      setEmail(inst.email);
      setPhone(inst.phone);
      setAddress(inst.address);
      setContactPerson(inst.contactPerson);
    }
  }, [slug]);

  const handleSave = () => {
    toast("success", isBn ? "সেটিংস সফলভাবে সংরক্ষিত হয়েছে!" : "Settings saved successfully!");
  };

  if (!mounted) return <SettingsSkeleton isDark={isDark} />;

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-2xl"
    : "bg-white border border-zinc-200 rounded-2xl shadow-sm";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? 'সেটিংস' : 'Settings'}
          </h1>
          <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            {isBn ? 'প্রতিষ্ঠানের সেটিংস এবং পছন্দ কনফিগার করুন' : 'Configure institution settings and preferences'}
          </p>
        </div>

        <Tabs defaultValue="general">
          <div className={`${card} p-1 mb-8`}>
            <TabsList>
              <TabsTrigger value="general">{isBn ? 'সাধারণ' : 'General'}</TabsTrigger>
              <TabsTrigger value="notifications">{isBn ? 'বিজ্ঞপ্তি' : 'Notifications'}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="general">
            <div className={`${card} p-5`}>
              <div className="space-y-4">
                <div>
                  <label className={`block text-[11px] mb-1.5 font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'প্রতিষ্ঠানের নাম' : 'Institution Name'}</label>
                  <Input
                    value={instName}
                    onChange={(e) => setInstName(e.target.value)}
                    className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}
                  />
                </div>
                <div>
                  <label className={`block text-[11px] mb-1.5 font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'ইমেইল' : 'Email'}</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}
                  />
                </div>
                <div>
                  <label className={`block text-[11px] mb-1.5 font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'ফোন' : 'Phone'}</label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}
                  />
                </div>
                <div>
                  <label className={`block text-[11px] mb-1.5 font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'ঠিকানা' : 'Address'}</label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}
                  />
                </div>
                <div>
                  <label className={`block text-[11px] mb-1.5 font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{isBn ? 'যোগাযোগ ব্যক্তি' : 'Contact Person'}</label>
                  <Input
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className={isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200"}
                  />
                </div>
                <button onClick={handleSave} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-medium transition-colors ${isDark ? "bg-white/[0.08] text-white hover:bg-white/[0.12]" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
                  <Save className="h-4 w-4" /> {isBn ? 'পরিবর্তন সংরক্ষণ করুন' : 'Save Changes'}
                </button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications">
            <div className={`${card} p-5`}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>{isBn ? 'ইমেইল বিজ্ঞপ্তি' : 'Email Notifications'}</p>
                    <p className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>{isBn ? 'গুরুত্বপূর্ণ ইভেন্টের জন্য ইমেইল আপডেট পান' : 'Receive email updates for important events'}</p>
                  </div>
                  <input type="checkbox" className="h-4 w-4 rounded" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>{isBn ? 'নিবন্ধন আপডেট' : 'Registration Updates'}</p>
                    <p className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>{isBn ? 'নিবন্ধন অনুমোদিত হলে বিজ্ঞপ্তি দিন' : 'Notify when registrations are approved'}</p>
                  </div>
                  <input type="checkbox" className="h-4 w-4 rounded" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>{isBn ? 'ফলাফল প্রকাশ' : 'Result Publications'}</p>
                    <p className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>{isBn ? 'ফলাফল প্রকাশিত হলে বিজ্ঞপ্তি দিন' : 'Notify when results are published'}</p>
                  </div>
                  <input type="checkbox" className="h-4 w-4 rounded" defaultChecked />
                </div>
                <button onClick={handleSave} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-medium transition-colors ${isDark ? "bg-white/[0.08] text-white hover:bg-white/[0.12]" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}>
                  <Save className="h-4 w-4" /> {isBn ? 'পরিবর্তন সংরক্ষণ করুন' : 'Save Changes'}
                </button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
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
        <div className={`${card} rounded-2xl h-10 mb-8 w-64`} />
        <div className={`${card} rounded-2xl h-64`} />
      </div>
    </div>
  );
}
