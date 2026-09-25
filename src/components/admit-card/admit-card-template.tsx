"use client";

import * as React from "react";
import { useBranding, BRANDING_DEFAULTS, BrandingSettings } from "@/lib/storage/branding";

/**
 * Admit card — modern landscape redesign (Delta Science reference, 2026).
 *
 * Landscape A4 (297×210mm): theme-colored full-bleed header (logo circle +
 * institution + code·session | gold exam code + exam title), light "Admit
 * Card" ribbon, photo + class badge beside a big examinee name over a
 * 2-column label/value grid, bordered zebra subjects table, dashed
 * perforation, QR verify stub with controller block, light bottom notice
 * strip, and a gold security strip overlaying the right edge.
 *
 * Everything is styled INLINE on purpose: html2canvas rasterises the card
 * for the bulk PDF and the print window receives a plain outerHTML clone
 * with no stylesheet — Tailwind classes would render unstyled there. Every
 * color is a literal hex (accent resolved from branding at render time), so
 * preview, PDF and print match pixel-wise. Typography is modern sans:
 * Inter for English, Kalpurush/Tiro Bangla for Bengali.
 *
 * The card is 297mm wide (landscape) with content-driven height capped at
 * 210mm; the exporter measures each card and draws it centered on its A4
 * landscape page.
 *
 * Language: all chrome follows `view.lang`; the root carries `lang="bn|en"`
 * so font fallback (Inter / Kalpurush / Tiro Bangla) resolves identically in
 * preview, PDF and print. Institution name stays English; association
 * branding lives in the watermark.
 */

const FONT = "'Inter', system-ui, -apple-system, 'Segoe UI', 'Kalpurush', 'Tiro Bangla', sans-serif";
/** Reference palette — light slate borders/grays (literal, PDF-safe). */
const BORDER = "1px solid #e2e8f0";
const SLATE_400 = "#94a3b8";
const SLATE_500 = "#64748b";
const SLATE_700 = "#334155";
/** Mock's gold security-strip / exam-code accent. */
const GOLD = "#d4af37";

export interface CardSubject {
  code: string; // "101", "102"… auto-numbered per class in routine order
  name: string;
  date?: string; // YYYY-MM-DD from the exam routine, '' when unscheduled
  startTime?: string;
  endTime?: string;
}

export interface CardView {
  key: string; // admit_cards.id — unique per card, used as ref key
  /** Active UI language — the whole card chrome follows this. */
  lang: "en" | "bn";
  institutionName: string;
  institutionCode?: string;
  institutionLogo?: string | null;
  examName: string;
  /** Exam code, e.g. "SE-26" — shown in gold in the header (reference). */
  examCode?: string;
  /** Exam start – end date, e.g. "Dec 31, 2026 – Jan 02, 2027". */
  examPeriod?: string;
  academicYear?: string;
  sessionName: string;
  studentName: string;
  photo?: string | null;
  fatherName?: string;
  motherName?: string;
  dob?: string;
  className: string;
  section?: string;
  classRoll?: string;
  examRoll: string;
  registrationNumber: string;
  centerName: string; // stored exam_center text
  centerCode?: string; // "(001)" style sequence when resolvable
  subjects: CardSubject[];
  qrDataUrl: string;
  /** Bilingual blob — EN lines + BN lines; filtered by lang at render. */
  instructions?: string;
  /** admit_cards.created_at — kept for provenance. */
  createdAt: string;
}

const rootStyle: React.CSSProperties = {
  width: "297mm",
  minHeight: "210mm",
  background: "#ffffff",
  color: "#000000",
  fontFamily: FONT,
  fontSize: "11px",
  lineHeight: 1.4,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  boxSizing: "border-box",
  position: "relative",
  borderRadius: "10px",
  // Stacking context so the negative-z watermark paints above the white
  // background but behind all card content (and survives html2canvas).
  isolation: "isolate",
};

/** Big faded association watermark behind the card — the official
 *  watermark. Uses the super-admin's uploaded image when set, otherwise the
 *  classic text crest built from the short/association names. */
function Watermark({ brand }: { brand: BrandingSettings }) {
  if (brand.brandWatermark) {
    return (
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%) rotate(-30deg)",
          zIndex: 0,
          opacity: 0.06,
          pointerEvents: "none",
          userSelect: "none",
          lineHeight: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={brand.brandWatermark}
          alt=""
          crossOrigin="anonymous"
          style={{ width: "170mm", height: "auto", display: "block" }}
        />
      </div>
    );
  }
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%) rotate(-30deg)",
        zIndex: 0,
        opacity: 0.06,
        textAlign: "center",
        pointerEvents: "none",
        whiteSpace: "nowrap",
        userSelect: "none",
      }}
    >
      <div
        style={{
          fontSize: "120px",
          fontWeight: 700,
          letterSpacing: "12px",
          lineHeight: 1,
          border: "6px solid #000000",
          padding: "14px 26px 10px",
        }}
      >
        {brand.brandShort || "BMA"}
      </div>
      <div style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "3px", marginTop: "10px" }}>
        {(brand.brandName || "Bangladesh Madrasah Association").toUpperCase()}
      </div>
      <div style={{ fontSize: "18px", letterSpacing: "2px", marginTop: "4px" }}>
        {brand.brandNameBn || "বাংলাদেশ মাদ্রাসা এসোসিয়েশন"}
      </div>
    </div>
  );
}

/** "Dec 31" (en) / "৩১ ডিসে" (bn) beside each subject. */
function formatCardDate(iso: string, bn: boolean): string {
  try {
    return new Date(iso).toLocaleDateString(bn ? "bn-BD" : "en-GB", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return iso;
  }
}

/** One half of a subject row: fixed code column + fluid name column.
 *  Uses deterministic centering (flex + text-align) that html2canvas
 *  renders identically to the browser preview — no gap/flexWrap quirks,
 *  explicit height on the row, inner cells fill row height. */
function SubjectHalf({
  subject,
  bn,
  divider,
}: {
  subject?: CardSubject;
  bn: boolean;
  /** true for the 2nd half of the row — draws the vertical divider. */
  divider?: boolean;
}) {
  if (!subject) {
    return (
      <>
        <div
          style={{
            width: "86px",
            flexShrink: 0,
            boxSizing: "border-box",
            borderLeft: divider ? BORDER : undefined,
            height: "100%",
          }}
        />
        <div style={{ flex: 1, minWidth: 0, height: "100%" }} />
      </>
    );
  }
  const time =
    subject.startTime && subject.endTime
      ? `${subject.startTime}–${subject.endTime}`
      : subject.startTime || subject.endTime || "";
  const when = [subject.date ? formatCardDate(subject.date, bn) : "", time]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div
        style={{
          width: "86px",
          flexShrink: 0,
          boxSizing: "border-box",
          padding: "8px 14px",
          fontSize: "12px",
          lineHeight: 1.35,
          color: SLATE_500,
          borderLeft: divider ? BORDER : undefined,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          height: "100%",
        }}
      >
        {subject.code}
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          boxSizing: "border-box",
          padding: "8px 14px",
          fontSize: "13px",
          lineHeight: 1.4,
          color: SLATE_700,
          wordBreak: "break-word",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          height: "100%",
        }}
      >
        <span style={{ textAlign: "center" }}>{subject.name}</span>
        {when ? (
          <span
            style={{
              fontSize: "10px",
              lineHeight: 1.2,
              color: SLATE_500,
              whiteSpace: "nowrap",
              marginLeft: "8px",
            }}
          >
            {when}
          </span>
        ) : null}
      </div>
    </>
  );
}

export function AdmitCardTemplate({ view }: { view: CardView }) {
  const bn = view.lang === "bn";

  // Association branding — same source as the landing page.
  const { data: brandData } = useBranding();
  const brand: BrandingSettings = { ...BRANDING_DEFAULTS, ...(brandData ?? {}) };
  const assocBn = brand.brandNameBn || "বাংলাদেশ মাদ্রাসা এসোসিয়েশন";
  const brandShort = brand.brandShort || "BMA";

  /** Literal accent hex for the header / name / ribbon — resolved here
   *  (never var(--brand-accent)) so the fill survives html2canvas AND the
   *  print window, which receives a bare outerHTML clone with no
   *  globals.css. Empty/invalid accent → near-black (light-theme default;
   *  white would vanish on paper). */
  const accentHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test((brand.accentColor || "").trim())
    ? brand.accentColor.trim()
    : "#18181b";

  /** Chrome strings follow the active language. */
  const L = (en: string, b: string) => (bn ? b : en);

  // Header meta line — "Institution Code X · Session Y" (reference layout).
  const sessionLabel = view.sessionName || view.academicYear;
  const headerMeta = [
    view.institutionCode
      ? `${L("Institution Code", "প্রতিষ্ঠানের কোড")} ${view.institutionCode}`
      : "",
    sessionLabel ? `${L("Session", "সেশন")} ${sessionLabel}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const hasRoutine = view.subjects.some((s) => s.date || s.startTime || s.endTime);

  // Pair subjects up for the 2-column table; pad the last row when odd.
  const subjectRows: Array<[CardSubject | undefined, CardSubject | undefined]> = [];
  for (let i = 0; i < view.subjects.length; i += 2) {
    subjectRows.push([view.subjects[i], view.subjects[i + 1]]);
  }

  const centerText = [
    view.centerCode ? `(${view.centerCode})` : "",
    view.centerName || "—",
  ]
    .filter(Boolean)
    .join(" ");

  const classNameFull = `${view.className}${
    view.section && view.section !== "—" ? ` / ${view.section}` : ""
  }`;

  // 2-column label/value grid — the reference's field set, plus class info.
  const fields: Array<{ label: string; value: string }> = [
    { label: L("Father's Name", "পিতার নাম"), value: view.fatherName || "—" },
    { label: L("Mother's Name", "মাতার নাম"), value: view.motherName || "—" },
    { label: L("Roll No.", "রোল নম্বর"), value: view.examRoll || "—" },
    { label: L("Registration No.", "নিবন্ধন নম্বর"), value: view.registrationNumber || "—" },
    { label: L("Exam Center", "পরীক্ষার কেন্দ্র"), value: centerText },
    { label: L("Date & Time", "তারিখ ও সময়"), value: view.examPeriod || "—" },
    { label: L("Class / Section", "শ্রেণি / শাখা"), value: classNameFull || "—" },
    { label: L("Class Roll", "ক্লাস রোল"), value: view.classRoll || "—" },
  ];

  return (
    <div lang={view.lang} className="admit-card-page" style={rootStyle}>
      <Watermark brand={brand} />

      {/* ── Header: theme-color full-bleed bar ───────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          background: accentHex,
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "18px",
          padding: "22px 36px 20px 36px",
        }}
      >
        {/* Left: Association logo + BMA title (main) + Institution (sub) + code·session */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            minWidth: 0,
            maxWidth: "62%",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              boxSizing: "border-box",
              background: brand.brandLogo ? "#ffffff" : "rgba(255,255,255,0.14)",
              border: brand.brandLogo ? undefined : "1px solid rgba(255,255,255,0.35)",
            }}
          >
            {brand.brandLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.brandLogo}
                alt=""
                crossOrigin="anonymous"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  padding: "5px",
                  boxSizing: "border-box",
                }}
              />
            ) : (
              <span
                style={{
                  fontSize: "18px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {(brand.brandShort || "BMA").trim().slice(0, 3)}
              </span>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "16.5px",
                fontWeight: 800,
                lineHeight: 1.15,
                letterSpacing: "0.2px",
                wordBreak: "break-word",
              }}
            >
              {L(brand.brandName || "Bangladesh Madrasah Association", brand.brandNameBn || "বাংলাদেশ মাদ্রাসা এসোসিয়েশন")}
            </div>
            <div
              style={{
                fontSize: "12.5px",
                fontWeight: 600,
                color: "#e2e8f0",
                lineHeight: 1.2,
                marginTop: "2px",
                wordBreak: "break-word",
              }}
            >
              {view.institutionName}
            </div>
            <div
              style={{
                fontSize: "10.5px",
                color: "#cbd5e1",
                marginTop: "2px",
                wordBreak: "break-word",
              }}
            >
              {headerMeta}
            </div>
          </div>
        </div>

        {/* Right: exam code (gold) + exam title */}
        <div style={{ textAlign: "right", maxWidth: "42%", minWidth: 0 }}>
          {view.examCode ? (
            <div
              style={{
                fontSize: "10.5px",
                fontWeight: 700,
                letterSpacing: "0.6px",
                color: GOLD,
              }}
            >
              {view.examCode}
            </div>
          ) : null}
          <div
            style={{
              fontSize: "13.5px",
              fontWeight: 500,
              marginTop: "2px",
              lineHeight: 1.25,
              wordBreak: "break-word",
            }}
          >
            {view.examName}
          </div>
        </div>
      </div>

      {/* ── Ribbon: "Admit Card" — flex-centered so PDF raster matches preview */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          background: "#f8fafc",
          borderBottom: BORDER,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "32px",
          fontSize: "14px",
          fontWeight: 700,
          letterSpacing: "0.08em",
          lineHeight: 1,
          color: accentHex,
          textAlign: "center",
        }}
      >
        {L("Admit Card", "প্রবেশপত্র")}
      </div>

      {/* ── Body: photo + badge | big name + 2-col fields ────────── */}
      <div style={{ display: "flex", gap: "28px", padding: "24px 36px 0", position: "relative", zIndex: 1 }}>
        <div
          style={{
            width: "128px",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <div
            style={{
              width: "124px",
              height: "156px",
              borderRadius: "8px",
              border: BORDER,
              background: "#f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              boxSizing: "border-box",
              position: "relative",
            }}
          >
            {view.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={view.photo}
                alt={L("Photo", "ছবি")}
                crossOrigin="anonymous"
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }}
              />
            ) : (
              <span style={{ fontSize: "12px", color: SLATE_400 }}>
                {L("Photo", "ছবি")}
              </span>
            )}
          </div>
          {/* Candidate badge — reference shows student type; we show class */}
          {view.className ? (
            <div
              style={{
                borderRadius: "999px",
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                color: "#047857",
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                padding: "2px 9px",
                boxSizing: "border-box",
              }}
            >
              {view.className}
            </div>
          ) : null}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: accentHex,
              lineHeight: 1.2,
              marginBottom: "14px",
              wordBreak: "break-word",
            }}
          >
            {view.studentName || "—"}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              columnGap: "26px",
              rowGap: "14px",
            }}
          >
            {fields.map((f) => (
              <div key={f.label} style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "10.5px",
                    fontWeight: 700,
                    letterSpacing: "0.6px",
                    textTransform: "uppercase",
                    color: SLATE_400,
                    marginBottom: "3px",
                  }}
                >
                  {f.label}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: SLATE_700,
                    lineHeight: 1.35,
                    wordBreak: "break-word",
                  }}
                >
                  {f.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Subjects: label + bordered zebra table ───────────────── */}
      <div style={{ padding: "20px 36px 0", position: "relative", zIndex: 1 }}>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            color: SLATE_500,
            marginBottom: "8px",
          }}
        >
          {L("Subjects", "বিষয়সমূহ")}
        </div>
        <div
          style={{
            border: BORDER,
            borderRadius: "8px",
            overflow: "hidden",
            background: "#ffffff",
            boxSizing: "border-box",
          }}
        >
          {view.subjects.length === 0 ? (
            <div
              style={{
                padding: "14px",
                textAlign: "center",
                fontSize: "13px",
                color: SLATE_500,
              }}
            >
              {L(
                "No subjects scheduled for this class.",
                "এই শ্রেণির জন্য কোনো বিষয় নির্ধারিত হয়নি।"
              )}
            </div>
          ) : (
            subjectRows.map(([a, b], i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  boxSizing: "border-box",
                  minHeight: "38px",
                  background: i % 2 === 1 ? "#f8fafc" : "#ffffff",
                  borderTop: i > 0 ? BORDER : undefined,
                }}
              >
                <SubjectHalf subject={a} bn={bn} />
                <SubjectHalf subject={b} bn={bn} divider />
              </div>
            ))
          )}
        </div>
        {!hasRoutine && view.subjects.length > 0 ? (
          <div style={{ fontSize: "10px", color: SLATE_500, marginTop: "6px" }}>
            {L(
              "Date / time of subjects will appear once the exam routine is published.",
              "রুটিন প্রকাশের পর বিষয়ের তারিখ / সময় দেখাবে।"
            )}
          </div>
        ) : null}
      </div>

      {/* ── Perforation (notches are print-hidden in the reference) ─ */}
      <div style={{ margin: "22px 36px 0", borderTop: "1px dashed #cbd5e1" }} />

      {/* ── Footer stub: QR + scan/ID | controller ────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "20px",
          padding: "18px 36px 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: "14px", minWidth: 0 }}>
          <div
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: "4px",
              padding: "3px",
              background: "#ffffff",
              boxSizing: "border-box",
              flexShrink: 0,
            }}
          >
            {view.qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={view.qrDataUrl}
                alt="QR"
                crossOrigin="anonymous"
                style={{ width: "64px", height: "64px", display: "block" }}
              />
            ) : (
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  color: SLATE_400,
                }}
              >
                QR
              </div>
            )}
          </div>
          <div style={{ fontSize: "11px", color: SLATE_500, lineHeight: 1.5, minWidth: 0 }}>
            <div>{L("Scan to verify candidate", "যাচাই করতে স্ক্যান করুন")}</div>
            <div>
              {L("ID No:", "আইডি নং:")} {view.registrationNumber || view.key.slice(0, 8)}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div
            style={{
              fontSize: "17px",
              fontStyle: "italic",
              fontWeight: 700,
              color: accentHex,
              lineHeight: 1.15,
            }}
          >
            {L("Controller of Examinations", "পরীক্ষা নিয়ন্ত্রক")}
          </div>
          <div
            style={{
              width: "165px",
              borderTop: `1px solid ${SLATE_400}`,
              margin: "8px auto 4px",
            }}
          />
          <div style={{ fontSize: "11px", color: SLATE_500 }}>
            {L(`Secretary, ${brandShort} Association`, `সাধারণ সম্পাদক, ${assocBn}`)}
          </div>
        </div>
      </div>

      {/* ── Bottom notice strip ───────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          background: "#f8fafc",
          borderTop: BORDER,
          textAlign: "center",
          fontSize: "10px",
          color: SLATE_400,
          padding: "10px 36px",
          boxSizing: "border-box",
        }}
      >
        {L(
          "This admit card is valid only with a matching photo ID. Report to the center 30 minutes before start time.",
          "এই প্রবেশপত্রটি বৈধ ছবিযুক্ত পরিচয়পত্র সহ প্রদর্শনযোগ্য। পরীক্ষা শুরুর ৩০ মিনিট পূর্বে কেন্দ্রে উপস্থিত থাকুন।"
        )}
      </div>

      {/* ── Gold security strip — overlays the right edge ────────── */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "8px",
          background:
            "linear-gradient(to bottom, #d4af37 0%, #b8860b 55%, #8a6508 100%)",
          zIndex: 3,
        }}
      />
    </div>
  );
}
