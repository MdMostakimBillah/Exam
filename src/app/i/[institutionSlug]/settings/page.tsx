"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { getInstitutionBySlug } from "@/lib/storage/institutions";
import { Settings, Building2, Bell, Save } from "lucide-react";

export default function InstitutionSettingsPage() {
  const params = useParams();
  const slug = params.institutionSlug as string;
  const { toast } = useToast();
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
    toast("success", "Settings saved successfully!");
  };

  if (!mounted) return <SettingsSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Configure institution settings and preferences." />

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Institution Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-zinc-500 font-medium block mb-2">Institution Name</label>
                <Input value={instName} onChange={(e) => setInstName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-medium block mb-2">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-medium block mb-2">Phone</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-medium block mb-2">Address</label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-medium block mb-2">Contact Person</label>
                <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
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
                <Bell className="h-4 w-4" /> Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-300">Email Notifications</p>
                  <p className="text-xs text-zinc-500">Receive email updates for important events</p>
                </div>
                <input type="checkbox" className="h-4 w-4 rounded" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-300">Registration Updates</p>
                  <p className="text-xs text-zinc-500">Notify when registrations are approved</p>
                </div>
                <input type="checkbox" className="h-4 w-4 rounded" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-300">Result Publications</p>
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
      </Tabs>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 skeleton rounded" />
      <div className="h-10 w-64 skeleton rounded" />
      <div className="h-96 skeleton rounded-2xl" />
    </div>
  );
}
