"use client";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const { toast } = useToast();
  const [platformName, setPlatformName] = useState("Bangladesh Education Society");
  const [tagline, setTagline] = useState("Scholarship Examination Management Platform");
  const [supportEmail, setSupportEmail] = useState("support@scholarx.local");
  const [contactPhone, setContactPhone] = useState("+880-2-XXXXXXXX");

  const handleSave = () => {
    toast("success", "Settings saved successfully!");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Configure platform settings and preferences." />

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="exam">Exam Settings</TabsTrigger>
          <TabsTrigger value="certificate">Certificate</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-4 w-4" /> Platform Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-zinc-500 font-medium block mb-2">Platform Name</label>
                <Input value={platformName} onChange={(e) => setPlatformName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-medium block mb-2">Tagline</label>
                <Input value={tagline} onChange={(e) => setTagline(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-medium block mb-2">Support Email</label>
                <Input type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-medium block mb-2">Contact Phone</label>
                <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              </div>
              <Button onClick={handleSave} className="gap-2 mt-2">
                <Save className="h-4 w-4" /> Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exam">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> Examination Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-zinc-500 font-medium block mb-2">Default Registration Fee (৳)</label>
                <Input type="number" defaultValue="100" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-medium block mb-2">Late Fee (৳)</label>
                <Input type="number" defaultValue="50" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-medium block mb-2">Pass Mark Percentage</label>
                <Input type="number" defaultValue="33" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-medium block mb-2">Scholarship Eligibility Percentage</label>
                <Input type="number" defaultValue="75" />
              </div>
              <Button onClick={handleSave} className="gap-2 mt-2">
                <Save className="h-4 w-4" /> Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certificate">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" /> Certificate Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-zinc-500 font-medium block mb-2">Certificate Prefix</label>
                <Input defaultValue="SCX" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-medium block mb-2">Organization Name</label>
                <Input defaultValue="Bangladesh Education Society" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-medium block mb-2">Signature Name</label>
                <Input defaultValue="Chairman" />
              </div>
              <Button onClick={handleSave} className="gap-2 mt-2">
                <Save className="h-4 w-4" /> Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-4 w-4" /> Notification Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>Email Notifications</p>
                  <p className="text-xs text-zinc-500">Receive email updates for important events</p>
                </div>
                <input type="checkbox" className="h-4 w-4 rounded" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>Registration Alerts</p>
                  <p className="text-xs text-zinc-500">Notify when new registrations are submitted</p>
                </div>
                <input type="checkbox" className="h-4 w-4 rounded" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>Result Publications</p>
                  <p className="text-xs text-zinc-500">Notify when results are published</p>
                </div>
                <input type="checkbox" className="h-4 w-4 rounded" defaultChecked />
              </div>
              <Button onClick={handleSave} className="gap-2 mt-2">
                <Save className="h-4 w-4" /> Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" /> Security Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-zinc-500 font-medium block mb-2">Session Timeout (minutes)</label>
                <Input type="number" defaultValue="30" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>Two-Factor Authentication</p>
                  <p className="text-xs text-zinc-500">Require 2FA for admin accounts</p>
                </div>
                <input type="checkbox" className="h-4 w-4 rounded" />
              </div>
              <Button onClick={handleSave} className="gap-2 mt-2">
                <Save className="h-4 w-4" /> Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
