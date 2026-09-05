"use client";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle, AlertTriangle, Info, Send, Trash2, Check } from "lucide-react";
import { formatDate } from "@/lib/storage/storage";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

const mockNotifications = [
  { id: "n1", title: "Registration Open", message: "SSC Scholarship 2026 registration is now open", type: "INFO" as const, timestamp: "2026-01-15T10:00:00Z", isRead: false },
  { id: "n2", title: "Exam Scheduled", message: "Preliminary exam scheduled for March 15, 2026", type: "INFO" as const, timestamp: "2026-01-14T09:00:00Z", isRead: false },
  { id: "n3", title: "New Institution Registered", message: "Dhaka Madrasa has registered", type: "INFO" as const, timestamp: "2026-01-13T14:30:00Z", isRead: true },
  { id: "n4", title: "Payment Received", message: "Payment of ৳5,000 received from Chittagong Madrasa", type: "SUCCESS" as const, timestamp: "2026-01-12T11:00:00Z", isRead: true },
  { id: "n5", title: "System Maintenance", message: "Scheduled maintenance on Jan 20, 2026 from 2:00 AM - 4:00 AM", type: "WARNING" as const, timestamp: "2026-01-11T08:00:00Z", isRead: false },
];

export default function NotificationsPage() {
  const { theme } = useTheme();
  const { lang: language } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState(mockNotifications);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <NotificationsSkeleton isDark={isDark} />;

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const card = isDark ? "bg-[#141416] border border-white/[0.06] rounded-2xl" : "bg-white border border-zinc-200 rounded-2xl shadow-sm";
  const iconBg = isDark ? "bg-white/[0.08]" : "bg-zinc-100";
  const iconColor = isDark ? "text-zinc-300" : "text-zinc-600";

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'SUCCESS': return <CheckCircle className="h-4 w-4 text-emerald-400" />;
      case 'WARNING': return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      case 'ERROR': return <AlertTriangle className="h-4 w-4 text-red-400" />;
      default: return <Info className="h-4 w-4 text-blue-400" />;
    }
  };

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? 'বিজ্ঞপ্তি' : 'Notifications'}
          </h1>
          <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            {isBn ? 'সিস্টেম সতর্কতা এবং আপডেট' : 'System alerts and updates'}
          </p>
        </div>
        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[
            { label: isBn ? 'মোট' : 'Total', value: notifications.length },
            { label: isBn ? 'অপঠিত' : 'Unread', value: unreadCount },
            { label: isBn ? 'পঠিত' : 'Read', value: notifications.length - unreadCount },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                <Bell className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{s.value}</p>
                <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Action Bar */}
        <div className={`${card} p-4 mb-6`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{isBn ? `${unreadCount}টি অপঠিত` : `${unreadCount} unread`}</span>
            <div className="flex gap-2">
              <button onClick={() => setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${isDark ? "bg-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200"}`}>
                <Check className="h-3.5 w-3.5" /> {isBn ? 'সব পড়ুন' : 'Mark all read'}
              </button>
              <button className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${isDark ? "bg-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.1]" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200"}`}>
                <Trash2 className="h-3.5 w-3.5" /> {isBn ? 'পুরনো মুছুন' : 'Clear read'}
              </button>
            </div>
          </div>
        </div>

        {/* Notification List */}
        <div className={`${card}`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center gap-2">
              <Bell className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'বিজ্ঞপ্তি' : 'Notifications'}</h3>
              <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>({notifications.length})</span>
            </div>
          </div>
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.08]' : 'bg-zinc-100'}`}>
                <Bell className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{isBn ? 'কোনো বিজ্ঞপ্তি নেই' : 'No notifications'}</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04] dark:divide-white/[0.04]">
              {notifications.map(n => (
                <div key={n.id} className={`px-5 py-4 flex items-start gap-4 transition-colors ${!n.isRead ? (isDark ? 'bg-white/[0.02]' : 'bg-zinc-50/50') : ''}`}>
                  <div className="mt-0.5">{getTypeIcon(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>{n.title}</p>
                      {!n.isRead && <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />}
                    </div>
                    <p className={`text-[11px] mt-0.5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{n.message}</p>
                    <p className={`text-[10px] mt-1 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>{formatDate(n.timestamp)}</p>
                  </div>
                  <button onClick={() => setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, isRead: true } : item))}
                    className={`p-1 rounded transition-colors ${isDark ? "hover:bg-white/[0.06]" : "hover:bg-zinc-100"}`}>
                    <CheckCircle className={`h-4 w-4 ${isDark ? "text-zinc-500 hover:text-white" : "text-zinc-400 hover:text-zinc-900"}`} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NotificationsSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";
  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`${card} rounded-2xl h-[52px]`} />
          ))}
        </div>
        <div className={`${card} rounded-2xl h-12 mb-6`} />
        <div className={`${card} rounded-2xl h-64`} />
      </div>
    </div>
  );
}
