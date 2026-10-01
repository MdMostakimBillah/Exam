/**
 * A4 academic transcript (marksheet) — board-style sheet in the shape of a
 * scanned HSC/SSC transcript: framed border, crest, grade-scale table,
 * dotted-leader candidate block, subject table with letter grade + grade
 * point and a tall GPA cell, then the publication date and the Controller of
 * Examinations signature.
 *
 * PRINT CONTRACT (same rules as <ResultSheet> / <AdmitCardTemplate>):
 * - everything INLINE (html2canvas 1.4.1 does not lay out `gap`, and grid
 *   support is partial — spacing is done with margins/flex + widths)
 * - fixed 794px width = A4 @96dpi; the container's minHeight is 1123px
 * - always-light, grayscale-safe palette: a printed sheet must read on white
 *   paper regardless of the app theme (no `var(--brand-accent)` here)
 * - labels are uppercased in JS: html2canvas ignores CSS text-transform
 *
 * One component feeds three surfaces: the public /marksheet lookup, the
 * student portal Marksheet section and the institution results action.
 */
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { Result } from "@/lib/types";

export const MARKSHEET_W_PX = 794;
export const MARKSHEET_H_PX = 1123;

const FONT =
  "'Inter', system-ui, -apple-system, 'Segoe UI', 'Noto Sans Bengali', 'Kalpurush', sans-serif";

/**
 * Heading face — a real serif (the scanned-board look: institution name,
 * ACADEMIC TRANSCRIPT, exam title). Body/table stays in FONT; the Bengali
 * fallbacks at the end keep Bangla headings on a readable face when no serif
 * Bengali font is installed. html2canvas resolves this per-glyph, so mixed
 * "BMA — একাডেমিক ট্রান্সক্রিপ্ট" strings are safe to print.
 */
const SERIF =
  "'Times New Roman', 'Liberation Serif', 'Nimbus Roman', Georgia, 'Noto Serif Bengali', 'Noto Sans Bengali', serif";

const INK = "#18181b";
const MUTED = "#71717a";
const LINE = "#a1a1aa";
const SOFT = "#f4f4f5";
const GREEN = "#166534";
const RED = "#b91c1c";

const thStyle: CSSProperties = {
  border: `1px solid ${LINE}`,
  background: SOFT,
  padding: "7px 9px",
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: "0.06em",
  color: INK,
  textAlign: "center",
  verticalAlign: "middle",
};

const tdStyle: CSSProperties = {
  border: `1px solid ${LINE}`,
  padding: "8px 9px",
  fontSize: 13,
  color: INK,
  textAlign: "center",
  verticalAlign: "middle",
};

/** A candidate line: fixed label + value on a dotted leader (the scan look). */
function LeaderRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", marginBottom: 7 }}>
      <div
        style={{
          width: 178,
          flexShrink: 0,
          fontSize: 12,
          fontWeight: 700,
          color: INK,
          paddingRight: 8,
          paddingBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          borderBottom: `1px dotted ${LINE}`,
          paddingBottom: 2,
          fontSize: 13.5,
          fontWeight: 600,
          color: INK,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

/** Letter grade for a percentage under the exam's bands (mirrors calculateGradeForSetup). */
function bandFor(percentage: number, bands: MarksheetGradeBand[]): MarksheetGradeBand | null {
  return (
    [...bands]
      .sort((a, b) => b.minPercent - a.minPercent)
      .find((band) => percentage >= band.minPercent && percentage <= band.maxPercent) ?? null
  );
}

export interface MarksheetGradeBand {
  id?: string;
  grade: string;
  points: number;
  minPercent: number;
  maxPercent: number;
}

export interface MarksheetSheetData {
  result: Result;
  gradeBands: MarksheetGradeBand[];
  passPercent?: number;
  fatherName?: string;
  motherName?: string;
  sessionName?: string;
  examDate?: string | null;
  /** Super admin's generation moment (0040) — printed as the publication date. */
  generatedAt?: string | null;
  /**
   * The exam's scholarship ranges, so the sheet can print the qualifying
   * % band next to the awarded category name (name alone is opaque on paper).
   */
  scholarshipCategories?: { name: string; minPercent: number; maxPercent: number }[];
}

export interface MarksheetSheetProps {
  data: MarksheetSheetData;
  lang: "en" | "bn";
  brandName: string;
  brandLogo: string;
  /** Pre-formatted publication date (locale applied by the caller). */
  generatedOn: string;
  /** MD signature image for the footer (branding.mdSignature), if any. */
  mdSignature?: string;
}

export const MarksheetSheet = forwardRef<HTMLDivElement, MarksheetSheetProps>(
  function MarksheetSheet({ data, lang, brandName, brandLogo, generatedOn, mdSignature }, ref) {
    const L = (en: string, bn: string) => (lang === "bn" ? bn : en);
    const cap = (en: string, bn: string) => (lang === "bn" ? bn : en.toUpperCase());

    const { result, gradeBands, passPercent = 33 } = data;

    const rows = result.subjectMarks.map((sm, i) => {
      const percent = sm.fullMarks > 0 ? (sm.marks / sm.fullMarks) * 100 : 0;
      const band = bandFor(percent, gradeBands);
      return {
        no: i + 1,
        name: sm.subjectName,
        marks: sm.marks,
        full: sm.fullMarks,
        letter: band?.grade ?? "F",
        point: band ? Number(band.points) : 0,
      };
    });

    const gpa =
      rows.length > 0
        ? Math.round((rows.reduce((sum, r) => sum + r.point, 0) / rows.length) * 100) / 100
        : 0;

    // ── Scholarship: result.scholarshipStatus carries the awarded CATEGORY
    //    NAME (whatever the exam's ranges were set up as, e.g. TALENT_POOL-2),
    //    or NOT_ELIGIBLE / PENDING. Print it under the marks with the
    //    qualifying % band so the paper says why it was awarded.
    const scholarshipRaw = (result.scholarshipStatus || "").trim();
    const scholarshipAwarded =
      !!scholarshipRaw && scholarshipRaw !== "NOT_ELIGIBLE" && scholarshipRaw !== "PENDING";
    const scholarshipRange = scholarshipAwarded
      ? (data.scholarshipCategories || []).find((c) => c.name === scholarshipRaw)
      : undefined;
    const scholarshipLabel = scholarshipAwarded
      ? scholarshipRaw
      : scholarshipRaw === "PENDING"
        ? L("Pending", "অপেক্ষমাণ")
        : L("Not eligible", "যোগ্য নয়");
    const overallGrade = result.grade || bandFor(result.percentage, gradeBands)?.grade || "—";

    // The top-right grade scale — one row per band, high → low.
    const scale = [...gradeBands]
      .sort((a, b) => b.minPercent - a.minPercent)
      .map((band) => ({
        letter: band.grade,
        range: `${Math.round(band.minPercent)}-${Math.round(band.maxPercent)}`,
        point: Number(band.points),
      }));

    const institutionName =
      (lang === "bn" ? result.institutionName : result.institutionNameEn) ||
      result.institutionName;

    const examYear = (result.examName.match(/\b(20\d{2})\b/) || [])[1] || "";

    const infoValue = (value: string, fallback = "—") => value?.trim() || fallback;

    return (
      <div
        ref={ref}
        lang={lang}
        style={{
          width: MARKSHEET_W_PX,
          minHeight: MARKSHEET_H_PX,
          boxSizing: "border-box",
          padding: 18,
          background: "#ffffff",
          color: INK,
          fontFamily: FONT,
          fontSize: 13,
          lineHeight: 1.45,
        }}
      >
        {/* Decorative double frame */}
        <div style={{ border: `3px solid ${INK}`, padding: 4, boxSizing: "border-box" }}>
          <div
            style={{
              border: `1px solid ${INK}`,
              padding: "24px 30px 26px",
              boxSizing: "border-box",
            }}
          >
            {/* ── Header: crest | title | grade scale ── */}
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              <div style={{ width: 74, flexShrink: 0 }}>
                {brandLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brandLogo}
                    alt=""
                    style={{
                      width: 62,
                      height: 62,
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
                      width: 62,
                      height: 62,
                      borderRadius: "50%",
                      border: `1px solid ${LINE}`,
                      background: SOFT,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 24,
                      color: INK,
                    }}
                  >
                    {brandName.trim().charAt(0).toUpperCase() || "B"}
                  </div>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0, textAlign: "center", padding: "0 8px 0" }}>
                <div
                  style={{
                    fontFamily: SERIF,
                    fontSize: 21,
                    fontWeight: 700,
                    color: INK,
                    lineHeight: 1.18,
                    letterSpacing: "0.01em",
                  }}
                >
                  {brandName}
                </div>
                <div
                  style={{
                    fontFamily: SERIF,
                    fontSize: 11.5,
                    color: INK,
                    letterSpacing: "0.26em",
                    paddingLeft: "0.26em",
                    marginTop: 4,
                  }}
                >
                  {L("Bangladesh", "বাংলাদেশ")}
                </div>
                <div
                  style={{
                    fontFamily: SERIF,
                    fontSize: 13.5,
                    fontWeight: 700,
                    letterSpacing: "0.24em",
                    paddingLeft: "0.24em",
                    color: INK,
                    marginTop: 11,
                  }}
                >
                  {cap("Academic Transcript", "একাডেমিক ট্রান্সক্রিপ্ট")}
                </div>
                <div
                  style={{
                    fontFamily: SERIF,
                    fontSize: 11,
                    fontStyle: "italic",
                    color: MUTED,
                    marginTop: 4,
                  }}
                >
                  {L("Statement of Marks", "গ্রেড ও নম্বরের বিবরণী")}
                </div>
              </div>

              <div style={{ width: 196, flexShrink: 0 }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 9.5,
                    color: INK,
                  }}
                >
                  <tbody>
                    <tr>
                      <th style={{ ...thStyle, padding: "4px 5px" }}>
                        {L("Letter Grade", "লেটার গ্রেড")}
                      </th>
                      <th style={{ ...thStyle, padding: "4px 5px" }}>{L("Marks", "নম্বর")}</th>
                      <th style={{ ...thStyle, padding: "4px 5px" }}>
                        {L("Grade Point", "গ্রেড পয়েন্ট")}
                      </th>
                    </tr>
                    {scale.map((band) => (
                      <tr key={band.letter + band.range}>
                        <td style={{ ...tdStyle, padding: "3px 5px", fontSize: 10, fontWeight: 600 }}>
                          {band.letter}
                        </td>
                        <td style={{ ...tdStyle, padding: "3px 5px", fontSize: 10 }}>{band.range}</td>
                        <td style={{ ...tdStyle, padding: "3px 5px", fontSize: 10 }}>
                          {band.point}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Exam title ── */}
            <div style={{ textAlign: "center", marginTop: 18, marginBottom: 14 }}>
              <div
                style={{
                  fontFamily: SERIF,
                  fontSize: 18.5,
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                  color: INK,
                }}
              >
                {/* Board style: title case (not shouted), serif — matches the
                    reference transcript's "… Examination - 2019". */}
                {result.examName}
                {examYear ? ` - ${examYear}` : ""}
              </div>
              {data.sessionName && (
                <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                  {L("Session", "সেশন")}: {data.sessionName}
                </div>
              )}
              <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>
                {L("Serial No", "সিরিয়াল নম্বর")}: {infoValue(result.registrationNumber)}
              </div>
            </div>

            {/* ── Candidate block ── */}
            <div style={{ marginTop: 2 }}>
              <LeaderRow
                label={L("Name of Student", "শিক্ষার্থীর নাম")}
                value={infoValue(result.studentName)}
              />
              <LeaderRow
                label={L("Father's Name", "পিতার নাম")}
                value={data.fatherName || ""}
              />
              <LeaderRow
                label={L("Mother's Name", "মাতার নাম")}
                value={data.motherName || ""}
              />
              <LeaderRow
                label={L("Institution", "প্রতিষ্ঠান")}
                value={infoValue(institutionName)}
              />

              <div style={{ display: "flex", alignItems: "flex-end", marginBottom: 7 }}>
                <div style={{ width: "50%", paddingRight: 14 }}>
                  <LeaderRow label={L("Roll No", "রোল নম্বর")} value={infoValue(String(result.roll))} />
                </div>
                <div style={{ width: "50%" }}>
                  <LeaderRow
                    label={L("Registration No", "রেজিস্ট্রেশন নম্বর")}
                    value={infoValue(result.registrationNumber)}
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-end", marginBottom: 7 }}>
                <div style={{ width: "50%", paddingRight: 14 }}>
                  <LeaderRow label={L("Class / Group", "শ্রেণি / গ্রুপ")} value={result.className} />
                </div>
                <div style={{ width: "50%" }}>
                  <LeaderRow
                    label={L("Exam Date", "পরীক্ষার তারিখ")}
                    value={data.examDate || ""}
                  />
                </div>
              </div>
            </div>

            {/* ── Subject table + GPA ── */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginTop: 12,
                border: `1px solid ${LINE}`,
                tableLayout: "fixed",
              }}
            >
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 44 }}>Sl.No.</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>
                    {L("Name of Subjects", "বিষয়ের নাম")}
                  </th>
                  <th style={{ ...thStyle, width: 92 }}>{L("Marks", "নম্বর")}</th>
                  <th style={{ ...thStyle, width: 84 }}>{L("Letter Grade", "গ্রেড")}</th>
                  <th style={{ ...thStyle, width: 76 }}>{L("Grade Point", "গ্রেড পয়েন্ট")}</th>
                  <th style={{ ...thStyle, width: 92 }}>GPA</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={`${row.no}-${row.name}`}>
                    <td style={tdStyle}>{row.no}</td>
                    <td style={{ ...tdStyle, textAlign: "left", fontWeight: 500 }}>{row.name}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>
                      {row.marks}
                      <span style={{ color: MUTED, fontWeight: 400 }}>/{row.full}</span>
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        fontWeight: 700,
                        color: row.letter === "F" ? RED : INK,
                      }}
                    >
                      {row.letter}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>
                      {row.point.toFixed(2)}
                    </td>
                    {i === 0 && (
                      <td
                        rowSpan={Math.max(rows.length, 1)}
                        style={{
                          ...tdStyle,
                          fontSize: 26,
                          fontWeight: 700,
                          letterSpacing: "0.02em",
                          background: SOFT,
                        }}
                      >
                        {gpa.toFixed(2)}
                        <div style={{ fontSize: 9, fontWeight: 600, color: MUTED, marginTop: 2 }}>
                          {L("Grade Point Average", "গ্রেড পয়েন্ট এভারেজ")}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td style={{ ...tdStyle, textAlign: "left" }} colSpan={5}>
                      {L("No subject marks available", "কোনো বিষয়ভিত্তিক নম্বর নেই")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* ── Totals strip ── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 10,
                fontSize: 11.5,
                color: INK,
              }}
            >
              <div>
                <span style={{ fontWeight: 700 }}>{L("Total", "মোট")}: </span>
                {result.totalMarks}/{result.totalFullMarks}
                <span style={{ color: MUTED }}>
                  {"  ·  "}
                  {L("Percentage", "শতকরা")}: {result.percentage.toFixed(1)}%
                </span>
                {result.position > 0 && (
                  <span style={{ color: MUTED }}>
                    {"  ·  "}
                    {L("Position", "অবস্থান")}: #{result.position}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontWeight: 700,
                  color: result.pass ? GREEN : RED,
                }}
              >
                {result.pass ? L("Result: PASS", "ফলাফল: উত্তীর্ণ") : L("Result: FAIL", "ফলাফল: অনুত্তীর্ণ")}
                {passPercent ? (
                  <span style={{ color: MUTED, fontWeight: 400 }}>
                    {"  "}
                    ({L("pass mark", "পাস মার্ক")} {passPercent}%)
                  </span>
                ) : null}
              </div>
            </div>

            {/* ── Scholarship category band — awarded from marks + percentage ── */}
            <div
              style={{
                display: "flex",
                marginTop: 10,
                border: `1px solid ${LINE}`,
                background: "#ffffff",
              }}
            >
              <div
                style={{
                  width: 176,
                  flexShrink: 0,
                  background: SOFT,
                  borderRight: `1px solid ${LINE}`,
                  padding: "9px 10px",
                  display: "flex",
                  alignItems: "center",
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: "0.09em",
                  color: MUTED,
                  lineHeight: 1.3,
                }}
              >
                {cap("Scholarship Category", "বৃত্তির ক্যাটাগরি")}
              </div>

              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "9px 12px",
                  fontSize: 14,
                  fontWeight: 700,
                  color: scholarshipAwarded ? INK : MUTED,
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  lineHeight: 1.3,
                }}
              >
                {scholarshipLabel}
                {scholarshipRange && (
                  <span style={{ fontSize: 11, fontWeight: 500, color: MUTED, paddingLeft: 8 }}>
                    {L("marks", "নম্বর")} {Math.round(scholarshipRange.minPercent)}–
                    {Math.round(scholarshipRange.maxPercent)}%
                  </span>
                )}
              </div>

              <div
                style={{
                  width: 232,
                  flexShrink: 0,
                  borderLeft: `1px solid ${LINE}`,
                  background: SOFT,
                  padding: "9px 12px",
                  fontSize: 12,
                  color: INK,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  lineHeight: 1.3,
                }}
              >
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: "0.09em",
                    color: MUTED,
                  }}
                >
                  {cap("Overall", "সারসংক্ষেপ")}
                </span>
                <span style={{ fontWeight: 700, textAlign: "right" }}>
                  {L("Grade", "গ্রেড")} {overallGrade}
                  <span style={{ color: LINE, fontWeight: 500 }}>{" · "}</span>
                  GPA {gpa.toFixed(2)}
                </span>
              </div>
            </div>

            {/* ── Footer: publication date + signature ── */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                marginTop: 34,
              }}
            >
              <div style={{ fontSize: 11.5, color: INK, maxWidth: 300 }}>
                <div style={{ fontStyle: "italic" }}>
                  {L("Date of publication of results", "ফলাফল প্রকাশের তারিখ")}:
                </div>
                <div style={{ fontWeight: 700, marginTop: 3 }}>{generatedOn}</div>
              </div>

              <div style={{ textAlign: "center", width: 230 }}>
                <div style={{ height: 40, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                  {mdSignature ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mdSignature}
                      alt=""
                      style={{ maxHeight: 40, maxWidth: 170, objectFit: "contain", display: "block" }}
                    />
                  ) : null}
                </div>
                <div
                  style={{
                    borderTop: `1px solid ${INK}`,
                    paddingTop: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    color: INK,
                  }}
                >
                  {L("Controller of Examinations", "কন্ট্রোলার অব পরীক্ষা")}
                </div>
                <div style={{ fontSize: 9.5, color: MUTED, marginTop: 1 }}>{brandName}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

MarksheetSheet.displayName = "MarksheetSheet";
