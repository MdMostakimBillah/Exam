/**
 * A4 result sheet — the single source of truth for BOTH the downloaded PDF
 * (html2canvas, see exportAdmitCardsPdf) and the print window.
 *
 * PRINT CONTRACT (same rules as <AdmitCardTemplate>):
 * - everything INLINE (html2canvas 1.4.1 does not lay out `gap`, and grid
 *   support is partial — spacing is done with margins/percent widths)
 * - fixed 794px width = A4 @96dpi; the container's minHeight is 1123px
 * - always-light, grayscale-safe palette: a printed sheet must read on white
 *   paper regardless of the app theme (so no `var(--brand-accent)` here —
 *   the accent is #ffffff in dark mode and would vanish on paper)
 * - labels are uppercased in JS: html2canvas ignores CSS text-transform
 */
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { Result } from "@/lib/types";

export const SHEET_W_PX = 794;
export const SHEET_H_PX = 1123;

const FONT =
  "'Inter', system-ui, -apple-system, 'Segoe UI', 'Noto Sans Bengali', 'Kalpurush', sans-serif";

const INK = "#18181b";
const MUTED = "#71717a";
const LINE = "#e4e4e7";
const SOFT = "#f4f4f5";
const GREEN = "#16a34a";
const RED = "#dc2626";

const labelStyle: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 600,
  letterSpacing: "0.07em",
  color: MUTED,
};

const valueStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: INK,
  marginTop: 4,
  lineHeight: 1.35,
  wordBreak: "break-word",
};

export interface ResultSheetProps {
  result: Result;
  lang: "en" | "bn";
  brandName: string;
  brandLogo: string;
  /** Pre-formatted "generated on" date (locale applied by the caller). */
  generatedOn: string;
  /** Absolute /verify-certificate URL shown in the footer. */
  verifyUrl: string;
}

export const ResultSheet = forwardRef<HTMLDivElement, ResultSheetProps>(
  function ResultSheet({ result, lang, brandName, brandLogo, generatedOn, verifyUrl }, ref) {
    const L = (en: string, bn: string) => (lang === "bn" ? bn : en);
    const cap = (en: string, bn: string) => (lang === "bn" ? bn : en.toUpperCase());

    const awarded =
      result.scholarshipStatus !== "NOT_ELIGIBLE" && result.scholarshipStatus !== "PENDING";

    const info: { label: string; value: string }[] = [
      { label: L("Student Name", "শিক্ষার্থীর নাম"), value: result.studentName },
      {
        label: L("Institution", "প্রতিষ্ঠান"),
        value: (lang === "bn" ? result.institutionName : result.institutionNameEn) ||
          result.institutionName,
      },
      { label: L("Class", "শ্রেণি"), value: result.className },
      { label: L("Examination", "পরীক্ষা"), value: result.examName },
      { label: L("Roll", "রোল"), value: String(result.roll || "—") },
      { label: L("Registration No", "রেজিস্ট্রেশন নম্বর"), value: result.registrationNumber },
    ];

    const summary: { label: string; value: string; color?: string }[] = [
      { label: L("Total", "মোট"), value: `${result.totalMarks}/${result.totalFullMarks}` },
      { label: L("Percentage", "শতকরা"), value: `${result.percentage.toFixed(1)}%` },
      { label: L("Grade", "গ্রেড"), value: result.grade || "—" },
      ...(result.position > 0
        ? [{ label: L("Position", "অবস্থান"), value: String(result.position) }]
        : []),
      {
        label: L("Result", "ফলাফল"),
        value: result.pass ? L("Pass", "উত্তীর্ণ") : L("Fail", "উত্তীর্ণ নয়"),
        color: result.pass ? GREEN : RED,
      },
    ];

    return (
      <div
        ref={ref}
        lang={lang}
        style={{
          width: SHEET_W_PX,
          minHeight: SHEET_H_PX,
          boxSizing: "border-box",
          padding: 44,
          background: "#ffffff",
          color: INK,
          fontFamily: FONT,
          fontSize: 13,
          lineHeight: 1.45,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {brandLogo ? (
              <img
                src={brandLogo}
                alt=""
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  objectFit: "contain",
                  background: "#ffffff",
                  border: `1px solid ${LINE}`,
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  border: `1px solid ${LINE}`,
                  background: SOFT,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 18,
                  color: INK,
                }}
              >
                {brandName.trim().charAt(0).toUpperCase() || "B"}
              </div>
            )}
            <div style={{ marginLeft: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: INK }}>{brandName}</div>
              <div style={{ fontSize: 10, color: MUTED, marginTop: 1 }}>
                {L("Scholarship Examination", "বৃত্তি পরীক্ষা")}
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: MUTED,
              textTransform: "none",
            }}
          >
            {cap("Result Sheet", "ফলাফল শিট")}
          </div>
        </div>

        <div style={{ height: 1, background: LINE, marginTop: 16 }} />

        {/* Title */}
        <div style={{ textAlign: "center", marginTop: 30, marginBottom: 26 }}>
          <div style={{ fontSize: 21, fontWeight: 700, color: INK }}>
            {L("Scholarship Examination Result", "বৃত্তি পরীক্ষার ফলাফল")}
          </div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>
            {result.examName}
            {" · "}
            {result.className}
          </div>
        </div>

        {/* Candidate info — two columns (even cells carry the gutter) */}
        <div style={{ display: "flex", flexWrap: "wrap", marginTop: 4 }}>
          {info.map((item, i) => (
            <div
              key={item.label}
              style={{
                width: "47%",
                marginRight: i % 2 === 0 ? "6%" : 0,
                marginBottom: 18,
              }}
            >
              <div style={labelStyle}>{cap(item.label, item.label)}</div>
              <div style={valueStyle}>{item.value || "—"}</div>
            </div>
          ))}
        </div>

        {/* Subject-wise marks */}
        {result.subjectMarks.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: INK,
                marginBottom: 8,
              }}
            >
              {L("Subject-wise Marks", "বিষয়ভিত্তিক নম্বর")}
            </div>
            <div style={{ border: `1px solid ${LINE}`, borderRadius: 6 }}>
              <div
                style={{
                  display: "flex",
                  background: SOFT,
                  borderBottom: `1px solid ${LINE}`,
                  padding: "8px 16px",
                }}
              >
                <div style={{ ...labelStyle, flex: 1 }}>{cap("Subject", "বিষয়")}</div>
                <div style={{ ...labelStyle, width: 84, textAlign: "right" }}>
                  {cap("Marks", "নম্বর")}
                </div>
                <div style={{ ...labelStyle, width: 84, textAlign: "right" }}>
                  {cap("Full", "পূর্ণ")}
                </div>
              </div>
              {result.subjectMarks.map((sm, i) => (
                <div
                  key={sm.subjectId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "9px 16px",
                    borderBottom:
                      i === result.subjectMarks.length - 1 ? "none" : `1px solid ${SOFT}`,
                  }}
                >
                  <div style={{ flex: 1, fontSize: 13, color: INK }}>{sm.subjectName}</div>
                  <div
                    style={{
                      width: 84,
                      textAlign: "right",
                      fontSize: 13,
                      fontWeight: 600,
                      color: INK,
                    }}
                  >
                    {sm.marks}
                  </div>
                  <div style={{ width: 84, textAlign: "right", fontSize: 13, color: MUTED }}>
                    {sm.fullMarks}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        <div
          style={{
            display: "flex",
            border: `1px solid ${LINE}`,
            borderRadius: 6,
            marginTop: 20,
            overflow: "hidden",
          }}
        >
          {summary.map((cell, i) => (
            <div
              key={cell.label}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "13px 6px",
                borderLeft: i === 0 ? "none" : `1px solid ${LINE}`,
              }}
            >
              <div style={{ ...labelStyle, fontSize: 9 }}>{cap(cell.label, cell.label)}</div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  marginTop: 5,
                  color: cell.color || INK,
                }}
              >
                {cell.value}
              </div>
            </div>
          ))}
        </div>

        {/* Scholarship */}
        {awarded && (
          <div
            style={{
              marginTop: 16,
              border: `1px solid #bbf7d0`,
              background: "#f0fdf4",
              borderRadius: 6,
              padding: "12px 16px",
              fontSize: 13,
              color: "#15803d",
              fontWeight: 600,
            }}
          >
            {L(
              `Congratulations! You are eligible for the ${result.scholarshipStatus} scholarship.`,
              `অভিনন্দন! আপনি ${result.scholarshipStatus} বৃত্তির জন্য যোগ্য।`
            )}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: 30,
            paddingTop: 12,
            borderTop: `1px solid ${LINE}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 10,
            color: MUTED,
          }}
        >
          <div>
            {L("Generated on", "তৈরির তারিখ")}: {generatedOn}
          </div>
          <div>
            {L("Verify:", "যাচাই:")}&nbsp;
            {verifyUrl || "/verify-certificate"}
          </div>
        </div>
      </div>
    );
  }
);

ResultSheet.displayName = "ResultSheet";
