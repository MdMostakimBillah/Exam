"use client";
import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { getNotifications, markAsRead, markAllAsRead, createNotification } from "@/lib/storage/notifications";
import { getCurrentUser } from "@/lib/auth/auth";
import { Notification } from "@/lib/types";
import { formatDate } from "@/lib/storage/storage";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { Bell, Check, CheckCheck, Send, Search, Filter } from "lucide-react";

export default function NotificationsPage() {
  const { theme } = useTheme();
  const { lang: language } = useLang();
  const { toast } = useToast();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [search, setSearch] = useState("");
  const [filterRead, setFilterRead] = useState<"all" | "read" | "unread">("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newType, setNewType] = useState<Notification["type"]>("info");

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted) {
      const user = getCurrentUser();
      if (user) {
        setNotifications(getNotifications().filter(n => n.userId === user.id));
      }
    }
  }, [mounted, refreshKey]);

  if (!mounted) return <NotificationsSkeleton isDark={isDark} />;

  const user = getCurrentUser();
  const unreadCount = notifications.filter(n => !n.read).length;
  const readCount = notifications.length - unreadCount;

  const filtered = notifications.filter(n => {
    const matchesSearch = n.title.toLowerCase().includes(search.toLowerCase()) || n.message.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filterRead === "all" ||
      (filterRead === "read" && n.read) ||
      (filterRead === "unread" && !n.read);
    return matchesSearch && matchesFilter;
  });

  const card = isDark ? "bg-[#141416] border border-white/[0.06] rounded-2xl" : "bg-white border border-zinc-200 rounded-2xl shadow-sm";
  const iconBg = isDark ? "bg-white/[0.08]" : "bg-zinc-100";
  const iconColor = isDark ? "text-zinc-300" : "text-zinc-600";

  const handleMarkAsRead = (id: string) => {
    markAsRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    toast("success", isBn ? "বিজ্ঞপ্তি পঠিত হিসাবে চিহ্নিত" : "Notification marked as read");
  };

  const handleMarkAllAsRead = () => {
    if (!user) return;
    markAllAsRead(user.id);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast("success", isBn ? "সব বিজ্ঞপ্তি পঠিত হিসাবে চিহ্নিত" : "All notifications marked as read");
  };

  const handleCreateNotification = () => {
    if (!user) return;
    if (!newTitle.trim() || !newMessage.trim()) {
      toast("error", isBn ? "শিরোনাম এবং বার্তা প্রয়োজন" : "Title and message are required");
      return;
    }
    createNotification({
      userId: user.id,
      title: newTitle.trim(),
      message: newMessage.trim(),
      type: newType,
      read: false,
    });
    setRefreshKey(k => k + 1);
    setShowModal(false);
    setNewTitle("");
    setNewMessage("");
    setNewType("info");
    toast("success", isBn ? "বিজ্ঞপ্তি প্রেরণ হয়েছে" : "Notification sent successfully");
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "success": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "warning": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "error": return "bg-red-500/10 text-red-400 border-red-500/20";
      default: return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "success": return "bg-emerald-500/10 text-emerald-400";
      case "warning": return "bg-amber-500/10 text-amber-400";
      case "error": return "bg-red-500/10 text-red-400";
      default: return "bg-blue-500/10 text-blue-400";
    }
  };

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
            {isBn ? "বিজ্ঞপ্তি" : "Notifications"}
          </h1>
          <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            {isBn ? "সিস্টেম সতর্কতা এবং আপডেট" : "System alerts and updates"}
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[
            { label: isBn ? "মোট" : "Total", value: notifications.length },
            { label: isBn ? "অপঠিত" : "Unread", value: unreadCount },
            { label: isBn ? "পঠিত" : "Read", value: readCount },
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

        {/* Filters & Actions */}
        <div className={`${card} p-4 mb-6`}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
              <input
                type="text"
                placeholder={isBn ? "শিরোনাম বা বার্তায় অনুসন্ধান..." : "Search by title or message..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 rounded-xl text-sm transition-colors ${
                  isDark
                    ? "bg-white/[0.04] border border-white/[0.06] text-white placeholder:text-zinc-500 focus:border-white/[0.12]"
                    : "bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-300"
                } focus:outline-none`}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterRead("all")}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  filterRead === "all"
                    ? isDark ? "bg-white/[0.1] text-white" : "bg-zinc-200 text-zinc-900"
                    : isDark ? "bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]" : "bg-zinc-50 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                }`}
              >
                <Filter className="h-3.5 w-3.5" /> {isBn ? "সব" : "All"}
              </button>
              <button
                onClick={() => setFilterRead("unread")}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  filterRead === "unread"
                    ? isDark ? "bg-white/[0.1] text-white" : "bg-zinc-200 text-zinc-900"
                    : isDark ? "bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]" : "bg-zinc-50 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                }`}
              >
                {isBn ? "অপঠিত" : "Unread"}
              </button>
              <button
                onClick={() => setFilterRead("read")}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  filterRead === "read"
                    ? isDark ? "bg-white/[0.1] text-white" : "bg-zinc-200 text-zinc-900"
                    : isDark ? "bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08]" : "bg-zinc-50 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                }`}
              >
                {isBn ? "পঠিত" : "Read"}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
            <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              {isBn ? `${filtered.length}টি বিজ্ঞপ্তি` : `${filtered.length} notifications`}
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleMarkAllAsRead}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                  isDark
                    ? "bg-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.1]"
                    : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200"
                }`}
              >
                <CheckCheck className="h-3.5 w-3.5" /> {isBn ? "সব পঠিত হিসাবে চিহ্নিত" : "Mark All Read"}
              </button>
              <button
                onClick={() => setShowModal(true)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                  isDark
                    ? "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                    : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                }`}
              >
                <Send className="h-3.5 w-3.5" /> {isBn ? "বিজ্ঞপ্তি প্রেরণ" : "Send Notification"}
              </button>
            </div>
          </div>
        </div>

        {/* Notification Table */}
        <div className={`${card} overflow-hidden`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center gap-2">
              <Bell className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                {isBn ? "বিজ্ঞপ্তি" : "Notifications"}
              </h3>
              <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"} `}>
                ({filtered.length})
              </span>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? "bg-white/[0.08]" : "bg-zinc-100"}`}>
                <Bell className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>
                {isBn ? "কোনো বিজ্ঞপ্তি নেই" : "No notifications"}
              </p>
              <p className={`text-xs mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                {isBn ? "নতুন বিজ্ঞপ্তি এখানে দেখা যাবে" : "New notifications will appear here"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isBn ? "ধরন" : "Type"}</TableHead>
                  <TableHead>{isBn ? "শিরোনাম" : "Title"}</TableHead>
                  <TableHead>{isBn ? "বার্তা" : "Message"}</TableHead>
                  <TableHead>{isBn ? "তারিখ" : "Date"}</TableHead>
                  <TableHead>{isBn ? "অবস্থা" : "Status"}</TableHead>
                  <TableHead className="text-right">{isBn ? "কার্যক্রম" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((n) => (
                  <TableRow key={n.id} className={!n.read ? (isDark ? "bg-white/[0.02]" : "bg-blue-50/30") : ""}>
                    <TableCell>
                      <div className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${getTypeIcon(n.type)}`}>
                        <Bell className="h-4 w-4" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium text-sm ${isDark ? "text-white" : "text-zinc-900"}`}>
                          {n.title}
                        </span>
                        {!n.read && (
                          <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                        {n.message}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                        {formatDate(n.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] border ${getTypeColor(n.type)}`}>
                        {n.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {!n.read && (
                        <button
                          onClick={() => handleMarkAsRead(n.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                            isDark
                              ? "bg-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.1]"
                              : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200"
                          }`}
                        >
                          <Check className="h-3 w-3" /> {isBn ? "পঠিত" : "Read"}
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Create Notification Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className={`relative w-full max-w-lg mx-4 rounded-2xl shadow-2xl ${
            isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200"
          }`}>
            <div className={`px-6 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                  {isBn ? "নতুন বিজ্ঞপ্তি প্রেরণ" : "Send New Notification"}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isDark ? "text-zinc-500 hover:text-white hover:bg-white/[0.06]" : "text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                  {isBn ? "শিরোনাম" : "Title"}
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={isBn ? "বিজ্ঞপ্তির শিরোনাম" : "Notification title"}
                  className={`w-full px-3 py-2 rounded-xl text-sm transition-colors ${
                    isDark
                      ? "bg-white/[0.04] border border-white/[0.06] text-white placeholder:text-zinc-500 focus:border-white/[0.12]"
                      : "bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-300"
                  } focus:outline-none`}
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                  {isBn ? "বার্তা" : "Message"}
                </label>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={isBn ? "বিজ্ঞপ্তির বার্তা" : "Notification message"}
                  rows={3}
                  className={`w-full px-3 py-2 rounded-xl text-sm transition-colors resize-none ${
                    isDark
                      ? "bg-white/[0.04] border border-white/[0.06] text-white placeholder:text-zinc-500 focus:border-white/[0.12]"
                      : "bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-300"
                  } focus:outline-none`}
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                  {isBn ? "ধরন" : "Type"}
                </label>
                <div className="flex gap-2">
                  {(["info", "success", "warning", "error"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setNewType(t)}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-colors border ${
                        newType === t
                          ? getTypeColor(t) + " border-current"
                          : isDark
                            ? "bg-white/[0.04] border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.08]"
                            : "bg-zinc-50 border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                      }`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className={`px-6 py-4 border-t flex justify-end gap-2 ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
              <button
                onClick={() => setShowModal(false)}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
                  isDark
                    ? "bg-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.1]"
                    : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200"
                }`}
              >
                {isBn ? "বাতিল" : "Cancel"}
              </button>
              <button
                onClick={handleCreateNotification}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors flex items-center gap-2 ${
                  isDark
                    ? "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                    : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                }`}
              >
                <Send className="h-3.5 w-3.5" /> {isBn ? "প্রেরণ" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
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
