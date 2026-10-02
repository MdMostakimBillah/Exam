"use client";

import { useState, useCallback, useEffect } from "react";
import { lookupCertificate } from "@/lib/auth/public-lookup";
import { Certificate } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, CheckCircle, ShieldCheck, XCircle, ShieldAlert } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { PublicNav } from "@/components/layout/public-nav";

export default function VerifyCertificatePage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [certNumber, setCertNumber] = useState("");
  const [searched, setSearched] = useState(false);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);

  const isButtonLoading = searchLoading;

  const runLookup = useCallback(async (value: string) => {
    const key = value.trim();
    if (!key) return;
    setSearched(true);
    setCertificate(null);
    setLookupError("");
    setSearchLoading(true);
    try {
      const res = await lookupCertificate(key);
      if (res.ok) setCertificate(res.certificate ?? null);
      else setLookupError(res.error || "Lookup failed. Please try again.");
    } catch {
      setLookupError("Lookup failed. Please try again.");
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearch = useCallback(() => runLookup(certNumber), [runLookup, certNumber]);

  // QR / link deep support: /verify-certificate?number=CERT-2026-0001
  // auto-verifies on arrival — the QR printed on every certificate encodes
  // exactly this URL, so scanning it shows the result with no typing.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const number = (params.get("number") || params.get("n") || "").trim();
    if (number) {
      setCertNumber(number);
      runLookup(number);
    }
  }, [runLookup]);

  const isRevoked = certificate?.status === "DRAFT";

  const bg = isDark ? "bg-[#080808]" : "bg-gray-50";

  return (
    <div className={`min-h-screen ${bg}`}>
      <PublicNav />

      <main className="max-w-xl mx-auto px-6 py-16">
        <div className="text-center mb-8">
          <div className="rounded-full bg-emerald-500/10 p-3 w-fit mx-auto mb-4">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
          </div>
          <h1 className={`text-2xl font-bold tracking-tight mb-2 ${isDark ? "text-zinc-100" : "text-gray-900"}`}>Verify Certificate</h1>
          <p className={`text-sm ${isDark ? "text-zinc-500" : "text-gray-500"}`}>Enter a certificate number to verify its authenticity.</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Certificate Number</label>
                <Input
                  value={certNumber}
                  onChange={(e) => setCertNumber(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                  placeholder="e.g. CERT-2026-0001"
                  maxLength={40}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <Button onClick={handleSearch} disabled={isButtonLoading || !certNumber} className="w-full">
                <Search className="h-4 w-4 mr-2" /> {isButtonLoading ? "Verifying..." : "Verify Certificate"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {searched && !certificate && !isButtonLoading && (
          <div className="mt-6 text-center py-8">
            <XCircle className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">
              {lookupError || "Certificate not found. Please check the certificate number."}
            </p>
          </div>
        )}

        {certificate && (
          <Card className={`mt-6 ${isRevoked ? "border-amber-500/20" : "border-emerald-500/20"}`}>
            <CardContent className="p-6">
              {isRevoked ? (
                <div className="flex items-center gap-3 rounded-md bg-amber-500/10 border border-amber-500/20 p-4 mb-6">
                  <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-300">Certificate Not Active</p>
                    <p className="text-xs text-amber-400/70">
                      This certificate exists but has been revoked or not yet issued, so it does not pass verification.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 p-4 mb-6">
                  <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-emerald-300">Certificate Verified</p>
                    <p className="text-xs text-emerald-400/60">This certificate is authentic and issued by ScholarX.</p>
                  </div>
                </div>
              )}
              <div className="space-y-3">
                {[
                  { label: 'Student', value: certificate.studentName },
                  { label: 'Institution', value: certificate.institutionNameEn || certificate.institutionName },
                  { label: 'Exam', value: certificate.examName },
                  { label: 'Year', value: certificate.examYear },
                  { label: 'Position', value: `#${certificate.position}` },
                  { label: 'Certificate Number', value: certificate.certificateNumber },
                  { label: 'Issue Date', value: new Date(certificate.issueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                    <span className="text-xs text-zinc-500">{item.label}</span>
                    <span className="text-sm text-zinc-200">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
