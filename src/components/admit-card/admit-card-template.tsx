"use client";

import * as React from "react";
import { formatDate } from "@/lib/storage/storage";

/**
 * National University–style admit card — one fixed A4 page (210mm × 297mm).
 *
 * Everything is styled INLINE on purpose: html2canvas rasterises it for the
 * bulk PDF and the print window receives a plain outerHTML clone with no
 * Tailwind sheet, so the design must be self-contained (real <table>s with
 * borders — the most reliable structure for both paths).
 *
 * Language: ALL card chrome (labels, pill, headings, instructions, captions)
 * follows `view.lang`. The root carries `lang="bn|en"` so font fallback
 * resolves identically in preview, PDF and print. The typewriter font is
 * protected from the global `html.lang-bn *` override by a scoped rule in
 * globals.css: Latin/numerals → Courier New, Bangla glyphs → Tiro Bangla.
 */

const FONT = "'Courier New', Courier, 'Tiro Bangla', monospace";
const BORDER = "1px solid #000000";

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

/** Big faded BMA crest behind the whole card — the official watermark. */
function Watermark() {
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
        BMA
      </div>
      <div style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "3px", marginTop: "10px" }}>
        BANGLADESH MADRASAH ASSOCIATION
      </div>
      <div style={{ fontSize: "18px", letterSpacing: "2px", marginTop: "4px" }}>
        বাংলাদেশ মাদ্রাসা এসোসিয়েশন
      </div>
    </div>
  );
}

/** label-cell + value-cell pair (two <td>s) inside a fields-table row. */
function FieldRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <>
      <td
        style={{
          border: BORDER,
          padding: 0,
          fontWeight: 700,
          fontSize: "10.5px",
          width: "37mm",
          background: "#ffffff",
          verticalAlign: "middle",
          textAlign: "center",
        }}
      >
        {/* Data lives in its own flex-centered div → renderer-proof centering */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            minHeight: "6.5mm",
            padding: "2px 7px",
            wordBreak: "break-word",
          }}
        >
          {label}
        </div>
      </td>
      <td
        style={{
          border: BORDER,
          padding: 0,
          fontSize: "11.5px",
          background: "#ffffff",
          verticalAlign: "middle",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            minHeight: "6.5mm",
            padding: "2px 7px",
            wordBreak: "break-word",
          }}
        >
          {value}
        </div>
      </td>
    </>
  );
}

function SubjectCell({
  subject,
  bn,
}: {
  subject?: CardSubject;
  bn: boolean;
}) {
  if (!subject) {
    return (
      <td style={{ border: BORDER, padding: 0 }}>
        <div style={{ minHeight: "6.5mm" }} />
      </td>
    );
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
    <td
      style={{
        border: BORDER,
        padding: 0,
        fontSize: "11px",
        verticalAlign: "middle",
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: "4px 8px",
          textAlign: "center",
          minHeight: "6.5mm",
          padding: "2px 7px",
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
    </td>
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

  const created = view.createdAt ? new Date(view.createdAt) : new Date();
  const isValidDate = !Number.isNaN(created.getTime());
  const dateOpts: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };

  return (
    <div lang={view.lang} className="admit-card-page" style={rootStyle}>
      <Watermark />
      {/* ── Header: photo | crest | titles | QR — rule underneath ── */}
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
            width: "26mm",
            height: "32mm",
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

        {view.institutionLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={view.institutionLogo}
            alt={L("Logo", "লোগো")}
            crossOrigin="anonymous"
            style={{ width: "20mm", height: "20mm", objectFit: "contain", flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: "18mm",
              height: "18mm",
              background: "#000000",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "13px",
              letterSpacing: "1px",
              flexShrink: 0,
            }}
          >
            BMA
          </div>
        )}

        <div style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
          <div
            style={{
              fontSize: "18px",
              fontWeight: 700,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              lineHeight: 1.2,
            }}
          >
            {view.institutionName}
          </div>
          <div style={{ fontSize: "11px", marginTop: "1px", color: "#222222" }}>
            {L("Bangladesh Madrasah Association", "বাংলাদেশ মাদ্রাসা এসোসিয়েশন")}
          </div>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 700,
              marginTop: "3px",
              textTransform: "uppercase",
              letterSpacing: "0.3px",
              lineHeight: 1.25,
            }}
          >
            {view.examName}
            {view.academicYear ? ` - ${view.academicYear}` : ""}
          </div>
        </div>

        <div style={{ width: "24mm", flexShrink: 0, textAlign: "center" }}>
          {view.qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={view.qrDataUrl}
              alt="QR"
              crossOrigin="anonymous"
              style={{ width: "24mm", height: "24mm", display: "block" }}
            />
          ) : (
            <div
              style={{
                width: "24mm",
                height: "24mm",
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

      {/* ── Outlined "Admit Card" pill (NU style) ─────────────────── */}
      <div style={{ textAlign: "center", margin: "3mm 0" }}>
        <span
          style={{
            display: "inline-block",
            border: "1.5px solid #000000",
            borderRadius: "4mm",
            padding: "3px 20px",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "1px",
            textTransform: "uppercase",
            background: "#ffffff",
          }}
        >
          {L("Admit Card", "প্রবেশপত্র")}
        </span>
      </div>

      {/* ── Bordered fields table ─────────────────────────────────── */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
          marginTop: "0.5mm",
        }}
      >
        <tbody>
          <tr>
            <FieldRow label={L("Examination Code", "পরীক্ষার কোড")} value={view.examCode || "—"} />
            <FieldRow label={L("Roll No.", "রোল নম্বর")} value={view.examRoll || "—"} />
          </tr>
          <tr>
            <FieldRow label={L("Name of Examinee", "পরীক্ষার্থীর নাম")} value={view.studentName || "—"} />
            <FieldRow label={L("Registration No.", "নিবন্ধন নম্বর")} value={view.registrationNumber || "—"} />
          </tr>
          <tr>
            <FieldRow label={L("Father's Name", "পিতার নাম")} value={view.fatherName || "—"} />
            <FieldRow label={L("Session", "সেশন")} value={view.sessionName || "—"} />
          </tr>
          <tr>
            <FieldRow label={L("Mother's Name", "মাতার নাম")} value={view.motherName || "—"} />
            <FieldRow
              label={L("Class / Section", "শ্রেণি / শাখা")}
              value={`${view.className}${view.section && view.section !== "—" ? ` / ${view.section}` : ""}`}
            />
          </tr>
          <tr>
            <FieldRow
              label={L("Institution Code & Name", "প্রতিষ্ঠানের কোড ও নাম")}
              value={
                view.institutionCode
                  ? `(${view.institutionCode}) ${view.institutionName}`
                  : view.institutionName
              }
            />
            <FieldRow label={L("Class Roll", "ক্লাস রোল")} value={view.classRoll || "—"} />
          </tr>
          <tr>
            <FieldRow
              label={L("Date of Birth", "জন্মতারিখ")}
              value={
                view.dob && view.dob !== "—"
                  ? (() => {
                      try {
                        return formatDate(view.dob);
                      } catch {
                        return view.dob;
                      }
                    })()
                  : "—"
              }
            />
            <FieldRow label={L("Exam Period", "পরীক্ষার সময়")} value={view.examPeriod || "—"} />
          </tr>
          {/* Full-width centered center row (NU style) */}
          <tr>
            <td
              colSpan={4}
              style={{
                border: BORDER,
                padding: 0,
                fontSize: "11.5px",
                background: "#ffffff",
                verticalAlign: "middle",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  minHeight: "7mm",
                  padding: "2px 6px",
                }}
              >
                <span>
                  <strong>{L("Center Code & Name", "কেন্দ্রের কোড ও নাম")}: </strong>
                  {centerText}
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Subject box: bordered header + 2-column grid ──────────── */}
      <div style={{ marginTop: "3.5mm" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <tbody>
            <tr>
              <td
                colSpan={2}
                style={{
                  border: BORDER,
                  padding: 0,
                  fontWeight: 700,
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.4px",
                  background: "#ffffff",
                  verticalAlign: "middle",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    minHeight: "7mm",
                    padding: "2px 7px",
                  }}
                >
                  {L("Subject Code & Name", "কোড ও বিষয়ের নাম")}
                </div>
              </td>
            </tr>
            {view.subjects.length === 0 ? (
              <tr>
                <td
                  colSpan={2}
                  style={{
                    border: BORDER,
                    padding: 0,
                    fontSize: "10.5px",
                    color: "#666666",
                    verticalAlign: "middle",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      minHeight: "12mm",
                      padding: "4px 7px",
                    }}
                  >
                    {L(
                      "No subjects scheduled for this class.",
                      "এই শ্রেণির জন্য কোনো বিষয় নির্ধারিত হয়নি।"
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              subjectRows.map(([a, b], i) => (
                <tr key={i}>
                  <SubjectCell subject={a} bn={bn} />
                  <SubjectCell subject={b} bn={bn} />
                </tr>
              ))
            )}
          </tbody>
        </table>
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
            {L("Secretary, BMA Association", "সাধারণ সম্পাদক, বাংলাদেশ মাদ্রাসা এসোসিয়েশন")}
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
