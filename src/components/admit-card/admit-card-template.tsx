"use client";

import * as React from "react";
import { formatDate } from "@/lib/storage/storage";
import { useBranding, BRANDING_DEFAULTS, BrandingSettings } from "@/lib/storage/branding";

/**
 * National University–style admit card — one fixed A4 page (210mm × 297mm).
 *
 * Everything is styled INLINE on purpose: html2canvas rasterises it for the
 * bulk PDF and the print window receives a plain outerHTML clone with no
 * Tailwind sheet, so the design must be self-contained. The bordered tables
 * are built from flex DIVs — one div per column, no <table>/<td> markup —
 * which rasterise identically in preview, PDF and print. Every cell centers
 * its data BOTH ways: vertically (align-items) and horizontally (text-align).
 *
 * Language: ALL card chrome (labels, pill, headings, instructions, captions)
 * follows `view.lang`. The root carries `lang="bn|en"` so font fallback
 * resolves identically in preview, PDF and print. The typewriter font is
 * protected from the global `html.lang-bn *` override by a scoped rule in
 * globals.css: Latin/numerals → Courier New, Bangla glyphs → Tiro Bangla.
 */

const FONT = "'Courier New', Courier, 'Tiro Bangla', monospace";
const BORDER = "1px solid #000000";

/** Shared cell chrome — every grid column is a <div> whose content is
 *  centered both vertically (align-items) and horizontally (text-align).
 *  boxSizing is explicit because the print window clones this markup WITHOUT
 *  the globals.css reset, so the browser default (content-box) would apply. */
const cellStyle: React.CSSProperties = {
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  minHeight: "6.5mm",
  padding: "2px 7px",
  background: "#ffffff",
  wordBreak: "break-word",
};

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
  /** Exam code, e.g. "SE-26" (NU's Examination Code position). */
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
  /** admit_cards.created_at — printed as Generated On. */
  createdAt: string;
}

const rootStyle: React.CSSProperties = {
  width: "210mm",
  height: "297mm",
  padding: "5mm 7mm 5mm",
  background: "#ffffff",
  color: "#000000",
  fontFamily: FONT,
  fontSize: "11px",
  lineHeight: 1.35,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  boxSizing: "border-box",
  position: "relative",
  // Stacking context so the negative-z watermark paints above the white
  // background but behind all card content (and survives html2canvas).
  isolation: "isolate",
};

/** Big faded association watermark behind the whole card — the official
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
          zIndex: -1,
          opacity: 0.07,
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
          style={{ width: "150mm", height: "auto", display: "block" }}
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
        zIndex: -1,
        opacity: 0.07,
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

/** Subject box: bordered header + 2-column div grid — see SubjectCell. */

function SubjectCell({
  subject,
  bn,
  divide,
}: {
  subject?: CardSubject;
  bn: boolean;
  /** true for the left column — draws the vertical divider. */
  divide?: boolean;
}) {
  const divider = divide ? { borderRight: BORDER } : undefined;
  if (!subject) {
    return <div style={{ ...cellStyle, flex: 1, minWidth: 0, ...divider }} />;
  }
  const time =
    subject.startTime && subject.endTime
      ? `${subject.startTime}–${subject.endTime}`
      : subject.startTime || subject.endTime || "";
  const when = [
    subject.date ? formatCardDate(subject.date, bn) : "",
    time,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      style={{
        ...cellStyle,
        flex: 1,
        minWidth: 0,
        fontSize: "11px",
        flexWrap: "wrap",
        gap: "4px 8px",
        ...divider,
      }}
    >
      <span>
        <strong>{subject.code} — </strong>
        {subject.name}
      </span>
      {when ? (
        <span style={{ fontSize: "9.5px", whiteSpace: "nowrap", color: "#333333" }}>
          {when}
        </span>
      ) : null}
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

export function AdmitCardTemplate({ view }: { view: CardView }) {
  const bn = view.lang === "bn";

  // Association branding — same source as the landing page.
  const { data: brandData } = useBranding();
  const brand: BrandingSettings = { ...BRANDING_DEFAULTS, ...(brandData ?? {}) };
  const assocEn = brand.brandName || "Bangladesh Madrasah Association";
  const assocBn = brand.brandNameBn || "বাংলাদেশ মাদ্রাসা এসোসিয়েশন";
  const brandShort = brand.brandShort || "BMA";

  /** Literal accent hex for the themed pill — resolved here (never
   *  var(--brand-accent)) so the fill survives html2canvas AND the print
   *  window, which receives a bare outerHTML clone with no globals.css.
   *  Empty/invalid accent → near-black (the light-theme default; white
   *  would vanish on paper). */
  const accentHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test((brand.accentColor || "").trim())
    ? brand.accentColor.trim()
    : "#18181b";

  /** Chrome strings follow the active language. */
  const L = (en: string, b: string) => (bn ? b : en);

  // Stored instructions mix EN + BN lines — show only the current language's set.
  const allLines = (view.instructions || "").split("\n").filter(Boolean);
  const instructionLines = allLines.filter((line) => {
    const isBangla = /[\u0980-\u09FF]/.test(line);
    return bn ? isBangla : !isBangla;
  });
  const nums = bn
    ? ["১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯", "১০"]
    : ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

  const hasRoutine = view.subjects.some((s) => s.date || s.startTime || s.endTime);

  // Pair subjects up for the 2-column grid; pad the last row when odd (NU look).
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

  // Header line 3 — exam name with its session (academic year as fallback).
  const sessionLabel = view.sessionName || view.academicYear;

  const created = view.createdAt ? new Date(view.createdAt) : new Date();
  const isValidDate = !Number.isNaN(created.getTime());
  const dateOpts: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };

  // Bordered fields grid — pairs of {label, value} columns per flex row.
  const dob = (() => {
    if (!view.dob || view.dob === "—") return "—";
    try {
      return formatDate(view.dob);
    } catch {
      return view.dob;
    }
  })();
  const fieldRows: Array<Array<{ label: string; value: React.ReactNode }>> = [
    [
      { label: L("Examination Code", "পরীক্ষার কোড"), value: view.examCode || "—" },
      { label: L("Roll No.", "রোল নম্বর"), value: view.examRoll || "—" },
    ],
    [
      { label: L("Name of Examinee", "পরীক্ষার্থীর নাম"), value: view.studentName || "—" },
      { label: L("Registration No.", "নিবন্ধন নম্বর"), value: view.registrationNumber || "—" },
    ],
    [
      { label: L("Father's Name", "পিতার নাম"), value: view.fatherName || "—" },
      { label: L("Session", "সেশন"), value: view.sessionName || "—" },
    ],
    [
      { label: L("Mother's Name", "মাতার নাম"), value: view.motherName || "—" },
      {
        label: L("Class / Section", "শ্রেণি / শাখা"),
        value: `${view.className}${view.section && view.section !== "—" ? ` / ${view.section}` : ""}`,
      },
    ],
    [
      {
        label: L("Institution Code & Name", "প্রতিষ্ঠানের কোড ও নাম"),
        value: view.institutionCode
          ? `(${view.institutionCode}) ${view.institutionName}`
          : view.institutionName,
      },
      { label: L("Class Roll", "ক্লাস রোল"), value: view.classRoll || "—" },
    ],
    [
      { label: L("Date of Birth", "জন্মতারিখ"), value: dob },
      { label: L("Exam Period", "পরীক্ষার সময়"), value: view.examPeriod || "—" },
    ],
  ];

  return (
    <div lang={view.lang} className="admit-card-page" style={rootStyle}>
      <Watermark brand={brand} />
      {/* ── Header: photo | titles | QR — rule underneath ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4mm",
          paddingBottom: "3mm",
          borderBottom: "2px solid #000000",
        }}
      >
        <div
          style={{
            width: "20mm",
            height: "20mm",
            border: BORDER,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
            background: "#fafafa",
          }}
        >
          {view.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={view.photo}
              alt={L("Photo", "ছবি")}
              crossOrigin="anonymous"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ fontSize: "8.5px", color: "#999999" }}>
              {L("PHOTO", "ছবি")}
            </span>
          )}
        </div>

        <div style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
          {/* 1. Main title — association name */}
          <div
            style={{
              fontSize: "19px",
              fontWeight: 700,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              lineHeight: 1.2,
            }}
          >
            {L(assocEn, assocBn)}
          </div>
          {/* 2. Institution name — always English (see buildCardView) */}
          <div
            style={{
              fontSize: "13px",
              fontWeight: 700,
              marginTop: "2px",
              textTransform: "uppercase",
              letterSpacing: "0.3px",
              lineHeight: 1.25,
              color: "#111111",
            }}
          >
            {view.institutionName}
          </div>
          {/* 3. Exam name with session */}
          <div
            style={{
              fontSize: "11.5px",
              fontWeight: 700,
              marginTop: "2px",
              textTransform: "uppercase",
              letterSpacing: "0.3px",
              lineHeight: 1.25,
              color: "#222222",
            }}
          >
            {view.examName}
            {sessionLabel ? ` - ${sessionLabel}` : ""}
          </div>
        </div>

        <div style={{ width: "20mm", flexShrink: 0, textAlign: "center" }}>
          {view.qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={view.qrDataUrl}
              alt="QR"
              crossOrigin="anonymous"
              style={{ width: "20mm", height: "20mm", display: "block" }}
            />
          ) : (
            <div
              style={{
                width: "20mm",
                height: "20mm",
                border: BORDER,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "7.5px",
                color: "#999999",
              }}
            >
              QR
            </div>
          )}
          <div style={{ fontSize: "7.5px", marginTop: "1.5mm", lineHeight: 1.2 }}>
            {L("Scan to check result", "ফলাফল দেখতে স্ক্যান")}
          </div>
        </div>
      </div>

      {/* ── Themed "Admit Card" pill — accent fill, centered ──────── */}
      <div style={{ textAlign: "center", margin: "3mm 0" }}>
        <span
          style={{
            display: "inline-block",
            border: `1.5px solid ${accentHex}`,
            borderRadius: "4mm",
            padding: "3px 20px",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "1px",
            textTransform: "uppercase",
            background: accentHex,
            color: "#ffffff",
          }}
        >
          {L("Admit Card", "প্রবেশপত্র")}
        </span>
      </div>

      {/* ── Bordered fields grid — one div per column, centered data ── */}
      <div style={{ border: BORDER, marginTop: "0.5mm", background: "#ffffff" }}>
        {fieldRows.map((pairs, r) => (
          <div
            key={r}
            style={{
              display: "flex",
              boxSizing: "border-box",
              borderBottom: r < fieldRows.length - 1 ? BORDER : undefined,
            }}
          >
            {pairs.map((p, c) => (
              <React.Fragment key={c}>
                {/* label column — fixed width like the old table-layout */}
                <div
                  style={{
                    ...cellStyle,
                    flex: "0 0 37mm",
                    fontSize: "10.5px",
                    fontWeight: 700,
                    borderRight: BORDER,
                  }}
                >
                  {p.label}
                </div>
                {/* data column */}
                <div
                  style={{
                    ...cellStyle,
                    flex: 1,
                    minWidth: 0,
                    fontSize: "11.5px",
                    borderRight: c < pairs.length - 1 ? BORDER : undefined,
                  }}
                >
                  {p.value}
                </div>
              </React.Fragment>
            ))}
          </div>
        ))}
        {/* Full-width centered center row (NU style) */}
        <div style={{ ...cellStyle, minHeight: "7mm", fontSize: "11.5px", borderTop: BORDER }}>
          <span>
            <strong>{L("Center Code & Name", "কেন্দ্রের কোড ও নাম")}: </strong>
            {centerText}
          </span>
        </div>
      </div>

      {/* ── Subject box: bordered header + 2-column div grid ──────── */}
      <div style={{ marginTop: "3.5mm" }}>
        <div style={{ border: BORDER, background: "#ffffff" }}>
          <div
            style={{
              ...cellStyle,
              minHeight: "7mm",
              fontWeight: 700,
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.4px",
            }}
          >
            {L("Subject Code & Name", "কোড ও বিষয়ের নাম")}
          </div>
          {view.subjects.length === 0 ? (
            <div
              style={{
                ...cellStyle,
                borderTop: BORDER,
                minHeight: "12mm",
                fontSize: "10.5px",
                color: "#666666",
                padding: "4px 7px",
              }}
            >
              {L(
                "No subjects scheduled for this class.",
                "এই শ্রেণির জন্য কোনো বিষয় নির্ধারিত হয়নি।"
              )}
            </div>
          ) : (
            subjectRows.map(([a, b], i) => (
              <div key={i} style={{ display: "flex", boxSizing: "border-box", borderTop: BORDER }}>
                <SubjectCell subject={a} bn={bn} divide />
                <SubjectCell subject={b} bn={bn} />
              </div>
            ))
          )}
        </div>
        {!hasRoutine && view.subjects.length > 0 ? (
          <div style={{ fontSize: "9px", color: "#555555", marginTop: "1.5mm" }}>
            {L(
              "Date / time of subjects will appear once the exam routine is published.",
              "রুটিন প্রকাশের পর বিষয়ের তারিখ / সময় দেখাবে।"
            )}
          </div>
        ) : null}
      </div>

      {/* ── Signature box: two equal halves, captions inside ──────── */}
      <div style={{ marginTop: "3.5mm", border: BORDER, display: "flex" }}>
        <div
          style={{
            flex: 1,
            padding: "3mm 6px 2.5mm",
            textAlign: "center",
            borderRight: BORDER,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          <div style={{ height: "9mm" }} />
          <div style={{ width: "45mm", borderBottom: "1px dotted #000000", margin: "0 auto 4px" }} />
          <div style={{ fontSize: "10.5px", fontWeight: 700, lineHeight: 1.3 }}>
            {L("Seal & Signature of Head of Institution", "প্রতিষ্ঠান প্রধানের সিল ও স্বাক্ষর")}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            padding: "3mm 6px 2.5mm",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              height: "9mm",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
            }}
          >
            <div style={{ width: "45mm", borderBottom: "1px dotted #000000" }} />
          </div>
          <div style={{ fontSize: "10.5px", fontWeight: 700, lineHeight: 1.3, marginTop: "4px" }}>
            {L("Controller of Examinations", "পরীক্ষা নিয়ন্ত্রক")}
          </div>
          <div style={{ fontSize: "9px", color: "#333333", lineHeight: 1.3 }}>
            {L(`Secretary, ${brandShort} Association`, `সাধারণ সম্পাদক, ${assocBn}`)}
          </div>
        </div>
      </div>

      {/* ── Instructions (left) + controller block (right) ────────── */}
      <div
        style={{
          display: "flex",
          gap: "5mm",
          marginTop: "3.5mm",
          border: BORDER,
          padding: "3mm 4mm",
        }}
      >
        <div style={{ flex: "1 1 70%", minWidth: 0 }}>
          <div
            style={{
              textAlign: "center",
              fontWeight: 700,
              fontSize: "11.5px",
              marginBottom: "2mm",
              textDecoration: "underline",
            }}
          >
            {L("Instructions for the Examinee", "পরীক্ষার্থীদের জন্য নির্দেশনা")}
          </div>
          {instructionLines.length > 0 ? (
            <ol style={{ margin: 0, paddingLeft: "5mm" }}>
              {instructionLines.map((line, i) => (
                <li
                  key={i}
                  style={{ fontSize: "9.8px", lineHeight: 1.45, marginBottom: "1.5mm", textAlign: "justify" }}
                >
                  <strong>{nums[i] || `${i + 1}`}.</strong>{" "}
                  {/* Stored lines already carry "1. " / "১. " — strip it when present. */}
                  {line.replace(/^[0-9০-৯]+[.)]?\s*/, "")}
                </li>
              ))}
            </ol>
          ) : (
            <div style={{ fontSize: "9.8px", color: "#666666" }}>
              {L(
                "Bring your registration card and arrive at the center 30 minutes before the exam.",
                "নিবন্ধন কার্ড নিয়ে পরীক্ষার ৩০ মিনিট আগে কেন্দ্রে উপস্থিত হন।"
              )}
            </div>
          )}
        </div>

        <div
          style={{
            flex: "0 0 30mm",
            textAlign: "center",
            borderLeft: BORDER,
            paddingLeft: "4mm",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {view.qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={view.qrDataUrl}
              alt="QR"
              crossOrigin="anonymous"
              style={{ width: "22mm", height: "22mm", display: "block" }}
            />
          ) : null}
          <div style={{ fontSize: "8.5px", fontWeight: 700, marginTop: "2mm", lineHeight: 1.3 }}>
            {L("CONTROLLER OF EXAMINATIONS", "পরীক্ষা নিয়ন্ত্রক")}
          </div>
          <div style={{ fontSize: "8.5px", color: "#444444", marginTop: "1mm", lineHeight: 1.3 }}>
            {L("Generated:", "তৈরি:")}{" "}
            {isValidDate
              ? created.toLocaleString(bn ? "bn-BD" : "en-GB", dateOpts)
              : ""}
          </div>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: "2.5mm",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "8mm",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 700 }}>
            {L("ID No:", "আইডি নং:")} {view.registrationNumber || view.key.slice(0, 8)}
          </div>
          <div
            style={{
              fontSize: "8.5px",
              color: "#444444",
              marginTop: "1mm",
              textAlign: "justify",
            }}
          >
            {L("Note:", "নোট:")}{" "}
            {L(
              "This document is system generated. Verify by scanning the QR code or visiting the result page.",
              "এই নথিটি সিস্টেম দ্বারা তৈরি। QR স্ক্যান করে বা ফলাফল পৃষ্ঠায় গিয়ে যাচাই করুন।"
            )}
          </div>
        </div>
        <div style={{ fontSize: "8.5px", color: "#666666", textAlign: "right", flexShrink: 0 }}>
          {L("Generated On:", "তৈরির সময়:")}{" "}
          {isValidDate
            ? created.toLocaleDateString(bn ? "bn-BD" : "en-GB", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })
            : ""}
        </div>
      </div>
    </div>
  );
}
