"use client";

/**
 * Certificate artwork — single source of truth for preview AND PDF.
 *
 * Fixed A4-landscape canvas (1123×794 px @96dpi = 297×210 mm) so the
 * rasterized PDF lands exactly on the page with no guesswork. Every style is
 * inline (html2canvas clones the DOM and needs computed values, not
 * Tailwind variants it can mis-resolve). The brand watermark follows the
 * shared rules: 130 mm wide, opacity 0.35, angle 0°.
 */

import { memo } from "react";
import type { Certificate } from "@/lib/types";
import { accentPalette } from "@/lib/utils/generate-pdf";
import { formatDate } from "@/lib/storage/storage";

export const CERT_W_PX = 1123; // 297 mm @ 96 dpi
export const CERT_H_PX = 794; // 210 mm @ 96 dpi
export const WM_WIDTH_PX = 491; // 130 mm @ 96 dpi — same seal size as admit card

const FONT_STACK =
  "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans Bengali', 'Kalpurush', 'Tiro Bangla', sans-serif";
const TITLE_FONT = "Georgia, 'Times New Roman', 'Noto Serif Bengali', serif";

export interface CertificateTemplateProps {
  cert: Certificate;
  companyName: string;
  companySubtitle?: string;
  accent?: string;
  watermarkUrl?: string;
  watermarkText?: string;
  qrDataUrl?: string;
  verifyUrl?: string;
  lang: "en" | "bn";
}

function CertificateTemplateImpl({
  cert,
  companyName,
  companySubtitle,
  accent,
  watermarkUrl,
  watermarkText,
  qrDataUrl,
  verifyUrl,
  lang,
}: CertificateTemplateProps) {
  const isBn = lang === "bn";
  const p = accentPalette(accent);
  const accentStr = `rgb(${p.rgb.join(",")})`;
  const tint = p.tint;
  const line = p.light;
  const institution = cert.institutionName || "";

  const sigLabel = isBn ? "প্রধান শিক্ষক / প্রতিষ্ঠান প্রধান" : "Principal / Head of Institution";
  const issuerLabel = isBn ? "অনুমোদিত স্বাক্ষরকর্তা" : "Authorized Signatory";

  const detailCell = (label: string, value: string) => (
    <div style={{ padding: "7px 22px", borderRight: `1px solid ${line}` }}>
      <div
        style={{
          fontSize: 8.5,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: "#8a8a8a",
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1c1c1c", whiteSpace: "nowrap" }}>
        {value}
      </div>
    </div>
  );

  const signature = (label: string) => (
    <div style={{ width: 240, textAlign: "center" }}>
      <div style={{ borderTop: "1px solid #9aa0a6", paddingTop: 7, fontSize: 11, color: "#4b4b4b" }}>
        {label}
      </div>
    </div>
  );

  const body = isBn ? (
    <>
      <span style={{ color: "#3d3d3d" }}>
        {institution}-এর প্রতিনিধিত্বে {cert.examName} ({isBn ? "শ্রেণী" : "Class"}: {cert.className},{" "}
        {isBn ? "সাল" : "Year"}: {cert.examYear}) পরীক্ষায়{" "}
      </span>
      <span style={{ fontWeight: 700, color: "#1c1c1c" }}>{cert.position}ম স্থান</span>
      <span style={{ color: "#3d3d3d" }}>
        {" "}
        অর্জন করে মোট {cert.totalMarks} নম্বর অর্জন করিয়াছেন।
      </span>
    </>
  ) : (
    <>
      <span style={{ color: "#3d3d3d" }}>has been awarded </span>
      <span style={{ fontWeight: 700, color: "#1c1c1c" }}>Position #{cert.position}</span>
      <span style={{ color: "#3d3d3d" }}> in {cert.examName}</span>
      <span style={{ color: "#3d3d3d" }}>
        {" "}
        ({isBn ? "শ্রেণী" : "Class"}: {cert.className}, {isBn ? "সাল" : "Year"}: {cert.examYear}),
        representing {institution}, securing a total of {cert.totalMarks} marks.
      </span>
    </>
  );

  return (
    <div
      lang={isBn ? "bn" : "en"}
      className="certificate-page"
      style={{
        width: CERT_W_PX,
        height: CERT_H_PX,
        position: "relative",
        overflow: "hidden",
        background: "#ffffff",
        color: "#1a1a1a",
        fontFamily: FONT_STACK,
        boxSizing: "border-box",
        flexShrink: 0,
      }}
    >
      {/* Brand watermark — 130 mm, 35% opacity, flat (angle 0°) */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          opacity: 0.35,
          zIndex: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        {watermarkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={watermarkUrl}
            alt=""
            crossOrigin="anonymous"
            style={{ width: WM_WIDTH_PX, height: "auto", maxHeight: WM_WIDTH_PX }}
          />
        ) : (
          <span
            style={{
              fontFamily: TITLE_FONT,
              fontSize: 190,
              fontWeight: 700,
              color: accentStr,
              letterSpacing: 8,
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            {watermarkText || "★"}
          </span>
        )}
      </div>

      {/* Double border */}
      <div
        style={{
          position: "absolute",
          inset: 14,
          border: `4px solid ${accentStr}`,
          zIndex: 1,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 25,
          border: `1px solid ${line}`,
          zIndex: 1,
          pointerEvents: "none",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          height: "100%",
          padding: "38px 56px 34px",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
        }}
      >
        {/* Masthead */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            width: "100%",
          }}
        >
          <div>
            <div style={{ fontSize: 21, fontWeight: 800, color: "#161616", letterSpacing: 0.3 }}>
              {companyName}
            </div>
            {companySubtitle ? (
              <div style={{ fontSize: 10.5, color: "#7d7d7d", marginTop: 2 }}>
                {companySubtitle}
              </div>
            ) : null}
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: 9,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: "#8a8a8a",
              }}
            >
              {isBn ? "সার্টিফিকেট নং" : "Certificate No."}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#1c1c1c",
                fontFamily: "'SFMono-Regular', Consolas, monospace",
                marginTop: 2,
              }}
            >
              {cert.certificateNumber}
            </div>
          </div>
        </div>

        {/* Title */}
        <div style={{ textAlign: "center", width: "100%", marginTop: 34 }}>
          <div
            style={{
              fontFamily: TITLE_FONT,
              fontSize: 40,
              fontWeight: 700,
              color: accentStr,
              letterSpacing: isBn ? 0 : 4,
              lineHeight: 1.15,
            }}
          >
            {isBn ? "পুরস্কার সনদ" : "Certificate of Award"}
          </div>
          <div
            style={{
              width: 250,
              height: 3,
              background: accentStr,
              margin: "10px auto 0",
            }}
          />
          <div
            style={{
              fontSize: 13,
              color: "#6f6f6f",
              fontStyle: "italic",
              marginTop: 18,
            }}
          >
            {isBn ? "এতদ্দ্বারা প্রত্যয়ন করা যাচ্ছে যে" : "This is to certify that"}
          </div>
          <div
            style={{
              fontSize: 42,
              fontWeight: 800,
              color: "#111111",
              marginTop: 8,
              lineHeight: 1.15,
              maxWidth: 900,
              margin: "8px auto 0",
            }}
          >
            {cert.studentName}
          </div>
          <div
            style={{
              fontSize: 13.5,
              lineHeight: 1.75,
              color: "#3d3d3d",
              marginTop: 14,
              maxWidth: 870,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {body}
          </div>
        </div>

        {/* Details strip */}
        <div
          style={{
            marginTop: 22,
            alignSelf: "center",
            display: "flex",
            alignItems: "stretch",
            background: tint,
            border: `1px solid ${line}`,
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          {detailCell(isBn ? "পরীক্ষা" : "Exam", cert.examName)}
          {detailCell(isBn ? "শ্রেণী" : "Class", cert.className)}
          {detailCell(isBn ? "অবস্থান" : "Position", `#${cert.position}`)}
          {detailCell(isBn ? "মোট নম্বর" : "Total Marks", String(cert.totalMarks))}
          <div style={{ padding: "7px 22px" }}>
            <div
              style={{
                fontSize: 8.5,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: "#8a8a8a",
                marginBottom: 3,
              }}
            >
              {isBn ? "প্রদানের তারিখ" : "Issue Date"}
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1c1c1c", whiteSpace: "nowrap" }}>
              {formatDate(cert.issueDate)}
            </div>
          </div>
        </div>

        {/* Signatures + QR */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            width: "100%",
          }}
        >
          {signature(sigLabel)}
          <div style={{ textAlign: "center" }}>
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt=""
                crossOrigin="anonymous"
                width={84}
                height={84}
                style={{ display: "block", margin: "0 auto", border: "1px solid #e2e2e2" }}
              />
            ) : (
              <div style={{ width: 84, height: 84, margin: "0 auto" }} />
            )}
            <div
              style={{
                fontSize: 10,
                color: "#555",
                marginTop: 6,
                fontFamily: "'SFMono-Regular', Consolas, monospace",
              }}
            >
              {cert.certificateNumber}
            </div>
            {verifyUrl ? (
              <div
                style={{
                  fontSize: 8.5,
                  color: "#909090",
                  marginTop: 2,
                  maxWidth: 300,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {verifyUrl}
              </div>
            ) : null}
          </div>
          {signature(issuerLabel)}
        </div>
      </div>
    </div>
  );
}

export const CertificateTemplate = memo(CertificateTemplateImpl);
