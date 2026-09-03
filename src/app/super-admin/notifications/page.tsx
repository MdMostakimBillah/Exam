"use client";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getNotifications, markAllAsRead } from "@/lib/storage/notifications";
import { getCurrentUser } from "@/lib/auth/auth";
import { Bell, CheckCircle, AlertTriangle, Info, XCircle, CheckCheck } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

export default function NotificationsPage() {
  const { theme } = useTheme();
  const { lang: language, t } = useLang();
  const isDark = theme === "dark";
  const [mounted, setMounted] = useState(false);
  const user = getCurrentUser();
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <div className="h-8 w-48 skeleton rounded" />;

  const notifications = user ? getNotifications().filter(n => n.userId === user.id) : [];

  const iconMap = { success: CheckCircle, warning: AlertTriangle, info: Info, error: XCircle };
  const colorMap = {
    success: isDark ? 'text-emerald-400 bg-emerald-500/10' : 'text-emerald-600 bg-emerald-500/10',
    warning: isDark ? 'text-amber-400 bg-amber-500/10' : 'text-amber-600 bg-amber-500/10',
    info: isDark ? 'text-blue-400 bg-blue-500/10' : 'text-blue-600 bg-blue-500/10',
    error: isDark ? 'text-red-400 bg-red-500/10' : 'text-red-600 bg-red-500/10',
  };

  return (
    <div>
      <PageHeader title="Notifications" description="View all your notifications.">
        <Button variant="outline" size="sm" onClick={() => user && markAllAsRead(user.id)}>
          <CheckCheck className="h-4 w-4 mr-2" /> Mark all read
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-600">No notifications</div>
          ) : (
            <div className={`divide-y ${isDark ? "divide-white/[0.04]" : "divide-zinc-100"}`}>
              {notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(n => {
                const Icon = iconMap[n.type] || Info;
                const color = colorMap[n.type] || colorMap.info;
                return (
                  <div key={n.id} className={`flex items-start gap-3 p-4 ${!n.read ? (isDark ? 'bg-white/[0.02]' : 'bg-zinc-50') : ''}`}>
                    <div className={`rounded-lg p-1.5 ${color}`}><Icon className="h-4 w-4" /></div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>{n.title}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{n.message}</p>
                      <p className={`text-[10px] ${isDark ? "text-zinc-700" : "text-zinc-400"} mt-1`}>{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                    {!n.read && <div className="h-2 w-2 rounded-full bg-blue-400 mt-2 shrink-0" />}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
