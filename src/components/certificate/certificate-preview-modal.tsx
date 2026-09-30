"use client";

/**
 * Certificate preview + download — shared by the super-admin and institution
 * certificate pages.
 *
 * Renders the real <CertificateTemplate> (full A4-landscape size) so what you
 * see is exactly what downloads. A second, offscreen copy of the same template
 * sits outside the modal for html2canvas to capture — this keeps the modal's
 * own transform/animation out of the rasterization.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useBranding, BRANDING_DEFAULTS } from "@/lib/storage/branding";
import { useInstitutionName } from "@/lib/storage/institutions";
import { useLang } from "@/contexts/language-context";
import { CertificateTemplate } from "@/components/certificate/certificate-template";
import type { Certificate } from "@/lib/types";
import { FileDown, ExternalLink, ShieldAlert } from "lucide-react";

interface CertificatePreviewModalProps {
  open: boolean;
  onClose: () => void;
  cert: Certificate | null;
}

/** Public verification URL for a certificate: the QR on the artwork encodes
 *  this exact link, so scanning it lands on an auto-verified lookup. */
export function certificateVerifyUrl(cert: Certificate): string {
  if (typeof window === "undefined") return "";
  const origin = window.location.origin;
  const raw = (cert.qrCode || "").trim();
  if (raw.startsWith("/")) return `${origin}${raw}`;
  if (raw.startsWith("http")) return raw;
  const number = raw || cert.certificateNumber;
  return `${origin}/verify-certificate?number=${encodeURIComponent(number)}`;
}

export function CertificatePreviewModal({ open, onClose, cert }: CertificatePreviewModalProps) {
  const { toast } = useToast();
  const { lang: language } = useLang();
  const isBn = language === "bn";
  const { data: branding } = useBranding();
  const instName = useInstitutionName();
  const captureRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [downloading, setDownloading] = useState(false);

  const verifyUrl = useMemo(() => (cert ? certificateVerifyUrl(cert) : ""), [cert]);

  // The artwork prints the institution name in the UI language: English name
  // when the app is English (same rule as every other list/label).
  const displayCert = useMemo(
    () => (cert ? { ...cert, institutionName: instName(cert.institutionName, cert.institutionId) } : null),
    [cert, instName]
  );

  // QR (~60 kB) only matters once a certificate is actually open.
  useEffect(() => {
    let cancelled = false;
    setQrDataUrl("");
    if (!open || !verifyUrl) return;
    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(verifyUrl, {
          margin: 1,
          width: 256,
          color: { dark: "#111111", light: "#ffffff" },
        })
      )
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, verifyUrl]);

  if (!cert || !displayCert) return null;

  const brand = { ...BRANDING_DEFAULTS, ...(branding || {}) };
  const companyName = isBn ? brand.brandNameBn || brand.brandName : brand.brandName;
  const companySubtitle = isBn ? brand.brandName : "";
  const isRevoked = cert.status === "DRAFT";

  const templateProps = {
    cert: displayCert,
    companyName,
    companySubtitle,
    accent: brand.accentColor,
    watermarkUrl: brand.brandWatermark || undefined,
    watermarkText: brand.brandShort || "BMA",
    qrDataUrl,
    verifyUrl,
    lang: (isBn ? "bn" : "en") as "bn" | "en",
  };

  const handleDownload = async () => {
    const el = captureRef.current;
    if (!el) return;
    setDownloading(true);
    try {
      const { exportCertificatePdf } = await import("@/lib/pdf/certificate-pdf");
      await exportCertificatePdf(el, `certificate_${cert.certificateNumber}.pdf`);
      toast("success", isBn ? "সার্টিফিকেট ডাউনলোড হয়েছে" : "Certificate downloaded");
    } catch {
      toast("error", isBn ? "ডাউনলোড ব্যর্থ হয়েছে" : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={isBn ? "সার্টিফিকেট প্রিভিউ" : "Certificate Preview"}
        description={`${cert.certificateNumber} · ${cert.studentName} · ${instName(
          cert.institutionName,
          cert.institutionId
        )}`}
        maxWidth="max-w-[1180px]"
      >
        {isRevoked ? (
          <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            {isBn
              ? "এই সার্টিফিকেটটি বর্তমানে নিষ্ক্রিয় (বাতিল) — সার্বজনীন যাচাইয়ে এটি গ্রহণযোগ্য নয়।"
              : "This certificate is currently inactive (revoked) and will not pass public verification."}
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <div className="flex w-max">
            <CertificateTemplate {...templateProps} />
          </div>
        </div>
        <ModalFooter>
          <a
            href={verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/[0.06]"
          >
            <ExternalLink className="h-4 w-4" />
            {isBn ? "যাচাই করুন" : "Verify online"}
          </a>
          <Button onClick={handleDownload} disabled={downloading} isLoading={downloading}>
            <FileDown className="mr-1.5 h-4 w-4" />
            {isBn ? "ডাউনলোড (PDF)" : "Download PDF"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Offscreen capture copy — same props, outside the modal's transform. */}
      {open ? (
        <div
          ref={captureRef}
          aria-hidden="true"
          style={{ position: "absolute", left: -10000, top: 0, pointerEvents: "none" }}
        >
          <CertificateTemplate {...templateProps} />
        </div>
      ) : null}
    </>
  );
}
