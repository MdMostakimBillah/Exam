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

/**
 * The marksheet heading face — public/fonts/Certificate 400.ttf (declared in
 * globals.css AND in the print window's <style>, see marksheet-pdf.ts).
 * Falls back to SERIF when the file is missing, so a stripped build still
 * prints a formal heading rather than Inter.
 */
const HEADING_FONT = "'Certificate', " + SERIF;

/**
 * Dynamic-value faces (Google Fonts — declared in globals.css AND in the print
 * window's <link>, see marksheet-pdf.ts):
 * - SCRIPT  — the personal fields (student / father / mother name), so the
 *             filled-in names read like entries on a real certificate.
 * - MONO    — every number and ID (roll, registration, marks, GPA, totals):
 *             fixed advance keeps the figures aligned.
 * - VALUE   — the other filled-in text (institution, class, exam date, subject).
 * The Bengali fallbacks at the end keep Bangla values on a readable face —
 * none of the three Latin faces has Bengali glyphs.
 */
/** The FILL-IN hand for every candidate-block value (student, father,
 *  mother, institution, roll, registration, class, exam date) — a script
 *  face at ONE size across the block. Bengali values fall through the stack:
 *  Dancing Script has no Bengali glyphs. */
const SCRIPT_FONT = "'Dancing Script', 'Noto Sans Bengali', 'Kalpurush', cursive";
const MONO_FONT =
  "'Fira Code', ui-monospace, SFMono-Regular, Menlo, 'Noto Sans Bengali', monospace";
const VALUE_FONT = "'Quantico', 'Inter', 'Noto Sans Bengali', sans-serif";

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
  fontSize: 12,
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

/** A candidate line: fixed label + value on a dotted leader (the scan look).
 *  `valueFont` swaps the FILL-IN face (Dancing Script throughout the block)
 *  and `valueSize` is deliberately constant across it — script fonts need a
 *  few px more than the 12px label to look the same size, but every value
 *  line must match every other. Labels stay in the label face, so the form
 *  still reads as label = static, value = filled in. */
function LeaderRow({
  label,
  value,
  valueFont,
  valueSize,
}: {
  label: string;
  value: string;
  valueFont?: string;
  valueSize?: number;
}) {
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
          fontSize: valueSize ?? 15,
          fontWeight: 700,
          color: INK,
          wordBreak: "break-word",
          ...(valueFont ? { fontFamily: valueFont } : null),
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
  /** Brand watermark (branding.brandWatermark) — rendered inside the sheet so
   *  preview, print and the downloaded PDF all carry it. Falls back to the
   *  short brand text (branding.brandShort) when no image is set. */
  watermarkUrl?: string;
  watermarkText?: string;
}

export const MarksheetSheet = forwardRef<HTMLDivElement, MarksheetSheetProps>(
  function MarksheetSheet(
    { data, lang, brandName, brandLogo, generatedOn, mdSignature, watermarkUrl, watermarkText },
    ref,
  ) {
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
          position: "relative",
          // Stacking context so the watermark paints above the white page but
          // behind every piece of content (and survives html2canvas).
          isolation: "isolate",
        }}
      >
        {/* Brand watermark — 130 mm, 35% opacity, flat (angle 0°), the same
            seal treatment as the admit card / certificate, so the PDF matches
            the on-screen preview. */}
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
              style={{ width: 491, height: "auto", maxHeight: 491 }}
            />
          ) : (
            <span
              style={{
                fontFamily: HEADING_FONT,
                fontSize: 150,
                fontWeight: 400,
                // Light grey, not ink: at 0.35 opacity black reads as printed
                // text over the marks table instead of a watermark.
                color: LINE,
                letterSpacing: 10,
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              {watermarkText || ""}
            </span>
          )}
        </div>

        {/* Decorative double frame */}
        <div
          style={{
            border: `3px solid ${INK}`,
            padding: 4,
            boxSizing: "border-box",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              border: `1px solid ${INK}`,
              padding: "20px 30px 22px",
              boxSizing: "border-box",
            }}
          >
            {/* ── Header row 1: crest | THE title, centred on the page ──
                The title gets its own full-width band (no table beside it) so
                it can be big (36px) AND sit on the page centre-line: two equal
                74px columns (crest / ghost) leave a 534px middle band whose
                centre is exactly 341px = half of the 682px content width. */}
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

              <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
                <div
                  style={{
                    fontFamily: HEADING_FONT,
                    fontSize: 36,
                    fontWeight: 400,
                    color: INK,
                    lineHeight: 1.14,
                    letterSpacing: "0.02em",
                  }}
                >
                  {brandName}
                </div>
                <div
                  style={{
                    fontFamily: SERIF,
                    fontSize: 13,
                    color: INK,
                    letterSpacing: "0.3em",
                    paddingLeft: "0.3em",
                    marginTop: 4,
                  }}
                >
                  {L("Bangladesh", "বাংলাদেশ")}
                </div>
                <div
                  style={{
                    fontFamily: SERIF,
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: "0.24em",
                    paddingLeft: "0.24em",
                    color: INK,
                    marginTop: 10,
                  }}
                >
                  {cap("Academic Transcript", "একাডেমিক ট্রান্সক্রিপ্ট")}
                </div>
                <div
                  style={{
                    fontFamily: SERIF,
                    fontSize: 12,
                    fontStyle: "italic",
                    color: MUTED,
                    marginTop: 4,
                  }}
                >
                  {L("Statement of Marks", "গ্রেড ও নম্বরের বিবরণী")}
                </div>
              </div>

              {/* Ghost column matching the crest: with the grade scale moved
                  out of the row, this is what keeps the title optically centred. */}
              <div style={{ width: 74, flexShrink: 0 }} aria-hidden="true" />
            </div>

            {/* ── Row 2: [172 ghost | exam title centred on the page | grade
                scale on the right]. Two equal 172px columns put the middle
                band's centre at 172 + 338/2 = 341px = the page centre, so the
                title under the main title never shifts when the scale sits in
                the side corner. */}
            <div style={{ display: "flex", alignItems: "flex-start", marginTop: 18 }}>
              <div style={{ width: 172, flexShrink: 0 }} aria-hidden="true" />

              <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
                <div
                  style={{
                    fontFamily: HEADING_FONT,
                    fontSize: 21,
                    fontWeight: 400,
                    letterSpacing: "0.03em",
                    color: INK,
                  }}
                >
                  {/* Board style: title case (not shouted), heading face — matches
                      the reference transcript's "… Examination - 2019". The year
                      lives INSIDE the exam name ("Scholarship-2026"), so it must
                      never be appended again — that printed "2026 - 2026". */}
                  {result.examName}
                </div>
                {data.sessionName && (
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                    {L("Session", "সেশন")}:{" "}
                    <span style={{ fontFamily: MONO_FONT }}>{data.sessionName}</span>
                  </div>
                )}
                <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>
                  {L("Serial No", "সিরিয়াল নম্বর")}:{" "}
                  <span style={{ fontFamily: MONO_FONT }}>
                    {infoValue(result.registrationNumber)}
                  </span>
                </div>
              </div>

              {/* Grade scale — right-hand side corner (was: centred below) */}
              <div style={{ width: 172, flexShrink: 0 }}>
                <table
                  style={{
                    width: 172,
                    borderCollapse: "collapse",
                    fontSize: 9,
                    color: INK,
                  }}
                >
                  <tbody>
                    <tr>
                      <th style={{ ...thStyle, padding: "2.5px 4px", fontSize: 9.5, letterSpacing: "0.05em" }}>
                        {L("Letter Grade", "লেটার গ্রেড")}
                      </th>
                      <th style={{ ...thStyle, padding: "2.5px 4px", fontSize: 9.5, letterSpacing: "0.05em" }}>
                        {L("Marks", "নম্বর")}
                      </th>
                      <th style={{ ...thStyle, padding: "2.5px 4px", fontSize: 9.5, letterSpacing: "0.05em" }}>
                        {L("Grade Point", "গ্রেড পয়েন্ট")}
                      </th>
                    </tr>
                    {scale.map((band) => (
                      <tr key={band.letter + band.range}>
                        <td style={{ ...tdStyle, padding: "1.5px 4px", fontSize: 9, fontWeight: 600 }}>
                          {band.letter}
                        </td>
                        <td style={{ ...tdStyle, padding: "1.5px 4px", fontSize: 9 }}>{band.range}</td>
                        <td style={{ ...tdStyle, padding: "1.5px 4px", fontSize: 9 }}>
                          {band.point}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Candidate block ── */}
            <div style={{ marginTop: 14 }}>
              {/* The fill-in hand: EVERY value of this block — names,
                  institution, roll, registration, class and exam date — is
                  written in Dancing Script at ONE size (see LeaderRow's
                  default and SCRIPT_FONT above). */}
              <LeaderRow
                label={L("Name of Student", "শিক্ষার্থীর নাম")}
                value={infoValue(result.studentName)}
                valueFont={SCRIPT_FONT}
              />
              <LeaderRow
                label={L("Father's Name", "পিতার নাম")}
                value={data.fatherName || ""}
                valueFont={SCRIPT_FONT}
              />
              <LeaderRow
                label={L("Mother's Name", "মাতার নাম")}
                value={data.motherName || ""}
                valueFont={SCRIPT_FONT}
              />
              <LeaderRow
                label={L("Institution", "প্রতিষ্ঠান")}
                value={infoValue(institutionName)}
                valueFont={SCRIPT_FONT}
              />

              <div style={{ display: "flex", alignItems: "flex-end", marginBottom: 7 }}>
                <div style={{ width: "50%", paddingRight: 14 }}>
                  <LeaderRow
                    label={L("Roll No", "রোল নম্বর")}
                    value={infoValue(String(result.roll))}
                    valueFont={SCRIPT_FONT}
                  />
                </div>
                <div style={{ width: "50%" }}>
                  <LeaderRow
                    label={L("Registration No", "রেজিস্ট্রেশন নম্বর")}
                    value={infoValue(result.registrationNumber)}
                    valueFont={SCRIPT_FONT}
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-end", marginBottom: 7 }}>
                <div style={{ width: "50%", paddingRight: 14 }}>
                  <LeaderRow
                    label={L("Class / Group", "শ্রেণি / গ্রুপ")}
                    value={result.className}
                    valueFont={SCRIPT_FONT}
                  />
                </div>
                <div style={{ width: "50%" }}>
                  <LeaderRow
                    label={L("Exam Date", "পরীক্ষার তারিখ")}
                    value={data.examDate || ""}
                    valueFont={SCRIPT_FONT}
                  />
                </div>
              </div>
            </div>

            {/* ── Subject table + GPA ── */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginTop: 16,
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
                    <td style={{ ...tdStyle, fontFamily: MONO_FONT }}>{row.no}</td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "left",
                        fontWeight: 500,
                        fontFamily: VALUE_FONT,
                      }}
                    >
                      {row.name}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600, fontFamily: MONO_FONT }}>
                      {row.marks}
                      <span style={{ color: MUTED, fontWeight: 400 }}>/{row.full}</span>
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        fontWeight: 700,
                        fontFamily: MONO_FONT,
                        color: row.letter === "F" ? RED : INK,
                      }}
                    >
                      {row.letter}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600, fontFamily: MONO_FONT }}>
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
                          fontFamily: MONO_FONT,
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
                marginTop: 18,
                fontSize: 11.5,
                color: INK,
              }}
            >
              <div>
                <span style={{ fontWeight: 700 }}>{L("Total", "মোট")}: </span>
                <span style={{ fontFamily: MONO_FONT }}>
                  {result.totalMarks}/{result.totalFullMarks}
                </span>
                <span style={{ color: MUTED }}>
                  {"  ·  "}
                  {L("Percentage", "শতকরা")}:{" "}
                  <span style={{ fontFamily: MONO_FONT }}>{result.percentage.toFixed(1)}%</span>
                </span>
                {result.position > 0 && (
                  <span style={{ color: MUTED }}>
                    {"  ·  "}
                    {L("Position", "অবস্থান")}:{" "}
                    <span style={{ fontFamily: MONO_FONT }}>#{result.position}</span>
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
                marginTop: 18,
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
                <span style={{ fontWeight: 700, textAlign: "right", fontFamily: MONO_FONT }}>
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
                marginTop: 28,
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
