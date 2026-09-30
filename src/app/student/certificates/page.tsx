"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStudentSession } from "@/lib/auth/student-auth";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { PageLoading } from "@/components/ui/page-loading";
import { Button } from "@/components/ui/button";
import { CertificatePreviewModal, certificateVerifyUrl } from "@/components/certificate/certificate-preview-modal";
import { useCertificatesByStudent } from "@/lib/storage/certificates";
import { formatDate } from "@/lib/storage/storage";
import { Award, BadgeCheck, ExternalLink, FileText, Loader2, ShieldCheck } from "lucide-react";
import type { Certificate } from "@/lib/types";

/**
 * Student Certificates — the student's own issued certificates with a
 * preview/download option. Permission-gated by the super admin's
 * `allow_certificate_download` flag (migration 0038), same mechanism as
 * admit cards. Revoked certificates (status DRAFT) never reach this list;
 * the nav item only renders when the flag is on.
 */
export default function StudentCertificatesPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const { lang: language } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";

  const { data: student, isLoading: studentLoading } = useStudentSession();
  const { data: certificates = [], isLoading: certsLoading } = useCertificatesByStudent(student?.id || "");
  const [previewCert, setPreviewCert] = useState<Certificate | null>(null);

  useEffect(() => {
    if (!studentLoading && !student) {
      router.push("/student/login");
    } else if (!studentLoading && student && !student.allowCertificateDownload) {
      router.push("/student/dashboard");
    }
  }, [student, studentLoading, router]);

  if (studentLoading || !student || !student.allowCertificateDownload) {
    return <PageLoading isDark={isDark} />;
  }

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-xl"
    : "bg-white border border-zinc-200 rounded-xl shadow-sm";
  const iconBg = "bg-brand-accent-soft";
  const iconColor = "text-brand-accent";

  const statusBadge = (cert: Certificate) => {
    if (cert.status === "VERIFIED") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <ShieldCheck className="h-3 w-3" /> {isBn ? "যাচাইকৃত" : "Verified"}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-400 border border-green-500/20">
        <BadgeCheck className="h-3 w-3" /> {isBn ? "প্রদত্ত" : "Issued"}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className={`text-xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
          {isBn ? "আমার সার্টিফিকেট" : "My Certificates"}
        </h1>
        <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
          {(isBn ? student.institutionName : student.institutionNameEn || student.institutionName) ||
            "\u00A0"}
          &middot; {student.class} {student.section && `- ${student.section}`}
        </p>
      </div>

      {/* Certificates list */}
      <div className={card}>
        <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
          <div className="flex items-center gap-2">
            <Award className={`h-4 w-4 ${iconColor}`} />
            <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? "সার্টিফিকেট" : "Certificates"}
            </h3>
            <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              ({certificates.length})
            </span>
          </div>
        </div>

        {certsLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className={`h-6 w-6 animate-spin ${iconColor}`} />
          </div>
        ) : certificates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center mb-3 ${iconBg}`}>
              <FileText className={`h-6 w-6 ${iconColor}`} />
            </div>
            <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? "এখনও কোনো সার্টিফিকেট নেই" : "No certificates yet"}
            </p>
            <p className={`text-[11px] mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              {isBn
                ? "আপনার সার্টিফিকেট তৈরি হলে এখানে দেখা যাবে।"
                : "Your certificates will appear here once issued."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
            {certificates.map((cert) => (
              <div
                key={cert.id}
                className={`px-5 py-4 flex items-center justify-between gap-4 ${
                  isDark ? "hover:bg-white/[0.02]" : "hover:bg-zinc-50/50"
                } transition-colors`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className={`text-sm font-medium truncate ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
                      {cert.examName}
                    </p>
                    {statusBadge(cert)}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] flex-wrap">
                    <span className={isDark ? "text-zinc-500" : "text-zinc-400"}>
                      {isBn ? "সার্টিফিকেট নং" : "Certificate No"}: {cert.certificateNumber}
                    </span>
                    <span className={isDark ? "text-zinc-500" : "text-zinc-400"}>
                      {isBn ? "শ্রেণি" : "Class"}: {cert.className}
                    </span>
                    {cert.issueDate ? (
                      <span className={isDark ? "text-zinc-500" : "text-zinc-400"}>
                        {isBn ? "তারিখ" : "Date"}: {formatDate(cert.issueDate).split(",")[0]}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setPreviewCert(cert)}>
                    <FileText className="h-3.5 w-3.5" />
                    {isBn ? "দেখুন ও ডাউনলোড" : "View & Download"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const url = certificateVerifyUrl(cert);
                      if (url) window.open(url, "_blank", "noopener,noreferrer");
                    }}
                    title={isBn ? "অনলাইনে যাচাই করুন" : "Verify online"}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Artwork preview with the real A4-landscape PDF download inside */}
      <CertificatePreviewModal
        open={!!previewCert}
        onClose={() => setPreviewCert(null)}
        cert={previewCert}
      />
    </div>
  );
}
