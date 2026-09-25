"use client";

import * as React from "react";
import { useBranding, BRANDING_DEFAULTS, BrandingSettings } from "@/lib/storage/branding";
import { DEFAULT_INSTRUCTIONS } from "@/lib/storage/admit-cards";

/**
 * Admit card — modern landscape redesign (Delta Science reference, 2026).
 *
 * Landscape A4 (297×210mm):
 *   1. Two-tier accent header — gold hairline, then the identity row
 *      (logo · association overline · institution · code/session meta |
 *      "ADMIT CARD" chip + gold exam code), a hairline, and the exam title
 *      row with its period on the right. The old washed-out "Admit Card"
 *      ribbon and the bottom notice strip are gone; their copy moved into
 *      the chip and the instructions panel.
 *   2. Photo + class/section badge beside a big examinee name over a
 *      2-column label/value grid (date/time and class/section were dropped
 *      here — the header and the badge already carry them).
 *   3. Bordered zebra subjects table.
 *   4. A minimal "Instructions" strip — three short columns (Before the Exam,
 *      Exam Hall Rules, Violation Warning) with no bottom note.
 *   5. Dashed perforation + QR verify stub with the three signature slots,
 *      and a gold security strip overlaying the right edge.
 *
 * VERTICAL BUDGET IS HARD: the exporter clamps each card to 210mm
 * (`heightMm = Math.min(heightPx / PX_PER_MM, PAGE_H_MM)`), so anything that
 * overflows is silently cropped out of the PDF. The card is a flex column
 * with `minHeight: 210mm`; the perforation and the stub carry
 * `marginTop: "auto"` so leftover space is absorbed between the body and the
 * tear-off line instead of pushing content past the page — and a long subject
 * list (6 rows) or a custom instruction note still fits. Verified with a
 * worst-case probe (10 subjects, unpublished routine, long names, custom
 * note) at exactly 794px in both languages.
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
const SLATE_600 = "#475569";
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
  /** Institution principal's signature image (Settings → Profile).
   *  Empty → blank signature line above the label. */
  principalSignature?: string | null;
  /** Institution-authored instruction blob — EN lines + BN lines. The shipped
   *  default is boilerplate the structured rules below now state properly, so
   *  only a customised blob is printed (see noteLines). */
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

/**
 * Footer signature slot: optional signature image (uploaded in Settings)
 * sitting above an italic accent title, a 165px rule and the designation
 * below it. The footer bottom-aligns its children, so the image never
 * pushes the rule out of line with the neighbouring "Controller of
 * Examinations" slot (the stack under the image is identical).
 * Inline styles only — html2canvas must paint it exactly as the preview.
 */
function FooterSignature({
  image,
  title,
  sub,
  accent,
}: {
  image?: string | null;
  title: string;
  sub: string;
  accent: string;
}) {
  return (
    <div style={{ textAlign: "center", flexShrink: 0 }}>
      {image ? (
        <div
          style={{
            height: "26px",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            marginBottom: "3px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt=""
            crossOrigin="anonymous"
            style={{
              maxHeight: "34px",
              maxWidth: "165px",
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>
      ) : null}
      <div
        style={{
          fontSize: "13px",
          fontStyle: "italic",
          fontWeight: 700,
          color: accent,
          lineHeight: 1.15,
        }}
      >
        {title}
      </div>
      <div
        style={{
          width: "165px",
          borderTop: `1px solid ${SLATE_400}`,
          margin: "6px auto 3px",
        }}
      />
      {/* Fixed 2-line box: the rule must sit on the same line as the
       *  neighbouring slots even when this designation wraps. */}
      <div
        style={{
          fontSize: "11px",
          lineHeight: 1.45,
          color: SLATE_500,
          maxWidth: "165px",
          wordBreak: "break-word",
          height: "32px",
        }}
      >
        {sub}
      </div>
    </div>
  );
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
          padding: "4px 14px",
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
          padding: "4px 14px",
          fontSize: "13px",
          lineHeight: 1.4,
          color: SLATE_700,
          wordBreak: "break-word",
          display: "flex",
          alignItems: "center",
          // Subject sits left and takes the available width; date/time is
          // pinned to the right edge of the cell (marginLeft, not gap —
          // html2canvas 1.4.1 does not lay out flex gap).
          justifyContent: "space-between",
          textAlign: "left",
          height: "100%",
        }}
      >
        <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>{subject.name}</span>
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

  // 2-column label/value grid. "Date & Time" lives in the header tier and
  // "Class / Section" in the badge under the photo — duplicating them here
  // only cost a whole extra grid row of vertical budget.
  const fields: Array<{ label: string; value: string }> = [
    { label: L("Father's Name", "পিতার নাম"), value: view.fatherName || "—" },
    { label: L("Mother's Name", "মাতার নাম"), value: view.motherName || "—" },
    { label: L("Roll No.", "রোল নম্বর"), value: view.examRoll || "—" },
    { label: L("Registration No.", "নিবন্ধন নম্বর"), value: view.registrationNumber || "—" },
    { label: L("Exam Center", "পরীক্ষার কেন্দ্র"), value: centerText },
    { label: L("Class Roll", "ক্লাস রোল"), value: view.classRoll || "—" },
  ];

  // ── Instructions to candidates — minimal, three short columns.
  const prepRules = [
    L("Report 30 minutes early.", "৩০ মিনিট আগে পৌঁছান।"),
    L("Photo ID required.", "পরিচয়পত্র বাধ্যতামূলক।"),
    L("Sit at your allotted seat.", "নির্ধারিত আসনে বসুন।"),
  ];
  const hallRules = [
    L("Mobile phones off.", "মোবাইল বন্ধ রাখুন।"),
    L("Answer sheet only.", "নির্ধারিত কাগজে লিখুন।"),
    L("No leaving without permission.", "অনুমতি ছাড়া বাইরে যাবেন না।"),
  ];
  const violationRules = [
    L("Malpractice cancels result.", "অসদুপায়ে ফলাফল বাতিল।"),
    L("No re-sitting if caught.", "ধরা পড়লে পুনরায় নিষিদ্ধ।"),
    L("Controller's decision final.", "পরীক্ষা নিয়ন্ত্রকের সিদ্ধান্ত চূড়ান্ত।"),
  ];

  // Institution-authored instruction blob — bilingual, one line per language.
  // The shipped default is boilerplate that the structured rules above now
  // state properly, so only a *customised* note is printed (no duplicates).
  const rawNote = (view.instructions || "").trim();
  const isDefaultNote = rawNote === DEFAULT_INSTRUCTIONS.trim();
  const noteLines =
    rawNote && !isDefaultNote
      ? rawNote
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
          .filter((s) => (bn ? /[\u0980-\u09ff]/.test(s) : !/[\u0980-\u09ff]/.test(s)))
      : [];

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
          padding: "14px 36px 12px",
        }}
      >
        {/* Gold hairline across the top edge — the modern accent detail. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "3px",
            background: `linear-gradient(to right, ${GOLD} 0%, rgba(255,255,255,0.55) 50%, ${GOLD} 100%)`,
          }}
        />

        {/* ── Tier 1: identity row ──────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "18px",
          }}
        >
        {/* Left: Association logo + overline + institution + code·session */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            minWidth: 0,
            maxWidth: "64%",
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
            {/* Overline — standard masthead order: body › institution › codes */}
            <div
              style={{
                fontSize: "9.5px",
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.78)",
                lineHeight: 1.2,
                wordBreak: "break-word",
              }}
            >
              {L(brand.brandName || "Bangladesh Madrasah Association", brand.brandNameBn || "বাংলাদেশ মাদ্রাসা এসোসিয়েশন")}
            </div>
            <div
              style={{
                fontSize: "15.5px",
                fontWeight: 800,
                lineHeight: 1.2,
                letterSpacing: "0.2px",
                marginTop: "2px",
                wordBreak: "break-word",
              }}
            >
              {view.institutionName}
            </div>
            <div
              style={{
                fontSize: "10px",
                color: "rgba(255,255,255,0.75)",
                marginTop: "2px",
                wordBreak: "break-word",
              }}
            >
              {headerMeta}
            </div>
          </div>
        </div>

        {/* Right: the document chip + exam code */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div
            style={{
              display: "inline-block",
              background: "rgba(255,255,255,0.16)",
              border: "1px solid rgba(255,255,255,0.5)",
              borderRadius: "4px",
              padding: "5px 14px",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              lineHeight: 1,
              whiteSpace: "nowrap",
              boxSizing: "border-box",
            }}
          >
            {L("Admit Card", "প্রবেশপত্র")}
          </div>
          {view.examCode ? (
            <div
              style={{
                marginTop: "5px",
                fontSize: "10.5px",
                fontWeight: 700,
                letterSpacing: "0.14em",
                color: GOLD,
              }}
            >
              {view.examCode}
            </div>
          ) : null}
        </div>
        </div>

        {/* ── Tier 2: exam title row under a hairline ───────────── */}
        <div style={{ height: "1px", background: "rgba(255,255,255,0.22)", margin: "8px 0 6px" }} />
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "18px",
          }}
        >
          <div
            style={{
              fontSize: "17px",
              fontWeight: 800,
              lineHeight: 1.2,
              letterSpacing: "0.2px",
              wordBreak: "break-word",
              minWidth: 0,
            }}
          >
            {view.examName}
          </div>
          {view.examPeriod ? (
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "rgba(255,255,255,0.85)",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {view.examPeriod}
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Body: photo + badge | big name + 2-col fields ────────── */}
      <div style={{ display: "flex", gap: "28px", padding: "15px 36px 0", position: "relative", zIndex: 1 }}>
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
          {/* Candidate badge — class + section (the grid no longer repeats it) */}
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
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {classNameFull}
            </div>
          ) : null}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "21px",
              fontWeight: 700,
              color: accentHex,
              lineHeight: 1.2,
              marginBottom: "10px",
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
              rowGap: "10px",
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
                    marginBottom: "2px",
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
      <div style={{ padding: "11px 36px 0", position: "relative", zIndex: 1 }}>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            color: SLATE_500,
            marginBottom: "6px",
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
                  minHeight: "30px",
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
          <div style={{ fontSize: "9.5px", color: SLATE_500, marginTop: "4px" }}>
            {L(
              "Date / time of subjects will appear once the exam routine is published.",
              "রুটিন প্রকাশের পর বিষয়ের তারিখ / সময় দেখাবে।"
            )}
          </div>
        ) : null}
      </div>

      {/* ── Instructions: preparation · hall rules · violation warning ── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          margin: "auto 36px 0",
          padding: "9px 12px 9px",
          boxSizing: "border-box",
          background: "#ffffff",
          border: BORDER,
          borderRadius: "8px",
        }}
      >
        {/* ── Instructions: minimal three-column strip ──────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: accentHex,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {L("Instructions", "নির্দেশনা")}
          </div>
          <div style={{ flex: 1, height: "1px", background: "#e2e8f0", minWidth: 0 }} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            columnGap: "14px",
            marginTop: "6px",
          }}
        >
          {[
            {
              head: L("Before the Exam", "পরীক্ষার আগে"),
              color: accentHex,
              items: prepRules,
            },
            {
              head: L("Exam Hall Rules", "পরীক্ষাকক্ষের নিয়ম"),
              color: SLATE_700,
              items: hallRules,
            },
            {
              head: L("Violation Warning", "লঙ্ঘনের সতর্কতা"),
              color: "#b45309",
              items: violationRules,
            },
          ].map((col) => (
            <div
              key={col.head}
              style={{
                minWidth: 0,
                borderTop: `2.5px solid ${col.color}`,
                paddingTop: "4px",
              }}
            >
              <div
                style={{
                  fontSize: "9px",
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: col.color,
                  marginBottom: "4px",
                  wordBreak: "break-word",
                }}
              >
                {col.head}
              </div>
              {col.items.map((t, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: "9px",
                    lineHeight: 1.4,
                    color: SLATE_600,
                    marginBottom: "3px",
                  }}
                >
                  <span style={{ color: col.color, marginRight: "4px" }}>•</span>
                  {t}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Perforation — auto top margin pins the stub to the card foot ─ */}
      <div style={{ margin: "auto 36px 0", borderTop: "1px dashed #cbd5e1" }} />

      {/* ── Footer stub: QR + scan/ID | controller ────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "20px",
          padding: "10px 36px 9px",
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
        {/* Right: MD + Principal + Controller signature slots */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: "24px", flexShrink: 0 }}>
          <FooterSignature
            image={brand.mdSignature}
            title={L("Managing Director", "নির্বাহী পরিচালক")}
            sub={L(`${brandShort} Association`, assocBn)}
            accent={accentHex}
          />
          <FooterSignature
            image={view.principalSignature}
            title={L("Principal", "অধ্যক্ষ")}
            sub={view.institutionName}
            accent={accentHex}
          />
          <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div
            style={{
              fontSize: "13px",
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
              margin: "6px auto 3px",
            }}
          />
          <div
            style={{
              fontSize: "11px",
              lineHeight: 1.45,
              color: SLATE_500,
              maxWidth: "165px",
              wordBreak: "break-word",
              height: "32px",
            }}
          >
            {L(`Secretary, ${brandShort} Association`, `সাধারণ সম্পাদক, ${assocBn}`)}
          </div>
          </div>
        </div>
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
