"use client";

import * as React from "react";
import { useBranding, BRANDING_DEFAULTS, BrandingSettings } from "@/lib/storage/branding";
import { DEFAULT_INSTRUCTIONS } from "@/lib/storage/admit-cards";

/**
 * Admit card — National-University-style PORTRAIT A4 (2026 redesign).
 *
 * Portrait A4 (210×297mm), black-on-white like the NU reference card:
 *   1. White masthead — photo | association overline, institution,
 *      exam title & period | QR — then a centred bordered "Admit Card" pill
 *      and a thin accent rule. No solid colour band: a filled header both
 *      guzzles toner in B&W and only looks right when the accent happens to
 *      print dark, so colour lives on the pill border / rule only. The
 *      masthead logo image was removed on request — the card carries the
 *      institution's name in type, the photo box already anchors the left.
 *   2. Fully-bordered label/value grid: Exam Code/Roll · Name/Reg No ·
 *      Father/Session · Mother/DOB · Class/Class Roll · College · Center.
 *   3. "Subject Code & name" table — grey header row + two subject pairs
 *      per row (code | name | code | name), every cell ruled #111, with the
 *      subject's exam time pinned to the RIGHT corner of its name cell
 *      ("10:00–13:00", from the routine; blank when unscheduled). Time only,
 *      never wrapped — it rides inside the existing row so the 297mm
 *      vertical budget is untouched.
 *   4. ONE bordered signature box split in two: Seal & Signature of
 *      Principal | Controller of Examinations (MD signature). The dashed
 *      perforation and tear-off QR stub are gone — NU has neither.
 *   5. Instructions to candidates as a NUMBERED list (1. / ১.) beside a
 *      right-hand verify block (QR + Controller + date).
 *   6. Footer: ID No + digital-signature note + Generated On line.
 *
 * PRINT CONTRACT — one file serves BOTH modes (html2canvas PDF and the
 * print window both clone this markup):
 *   · B&W: every structural rule is #111 at 1.25–1.5px and every label is
 *     #111 → dark, clean lines. The old #e2e8f0 rules / #94a3b8 labels are
 *     gone — they printed as faint, broken grey.
 *   · Colour: photo, principal seal/signature and the accent pill/rule keep
 *     their colour; `accentInk` refuses a wash-out (near-white) accent so a
 *     light brand colour can never vanish on paper, and the small numbered
 *     list uses a stricter `numInk` so mid-tone accents still print dark.
 *
 * VERTICAL BUDGET IS HARD: the exporter clamps each card to 297mm
 * (`heightMm = Math.min(heightPx / PX_PER_MM, PAGE_H_MM)`), so anything that
 * overflows is silently cropped out of the PDF — the footer (ID No) must
 * survive the worst case (10 subjects, unpublished routine, long names,
 * custom note, no photo). Five `<Gap>` flex spacers (min 3mm) sit between
 * the sections: they absorb ALL free space so the footer pins to the page
 * bottom, and they collapse to 3mm before anything can clip. Verified at
 * exactly 794px wide in both languages.
 *
 * Everything is styled INLINE on purpose: html2canvas rasterises the card
 * for the bulk PDF and the print window receives a plain outerHTML clone
 * with no stylesheet — Tailwind classes would render unstyled there. No
 * flex `gap` anywhere (html2canvas does not lay it out) — spacing is
 * margins/padding only. Every colour is a literal hex (accent resolved at
 * render time), so preview, PDF and print match pixel-wise. Typography:
 * Inter for English, Noto Sans Bengali (Google Fonts) for Bengali.
 *
 * Language: all chrome follows `view.lang`; the root carries `lang="bn|en"`
 * so font fallback resolves identically in preview, PDF and print.
 */

const FONT = "'Inter', system-ui, -apple-system, 'Segoe UI', 'Noto Sans Bengali', 'Kalpurush', 'Tiro Bangla', sans-serif";

/** Print-safe ink palette — literal hex, identical in preview/PDF/print. */
const INK = "#111111"; // structural rules + labels (dark in B&W)
const BLACK = "#000000"; // values / headings
const SHADE = "#f1f1f1"; // table header fill (light grey in both modes)
const MUTE = "#333333"; // secondary text (dates, footnotes)
const RULE = `1.5px solid ${INK}`; // outer frames
const CELL = `1.25px solid ${INK}`; // internal grid rules

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
  /** Exam code, e.g. "SE-26" — printed as the Examination Code field. */
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
   *  Empty → blank signature area above the label. */
  principalSignature?: string | null;
  /** Institution-authored instruction blob — EN lines + BN lines. The shipped
   *  default is boilerplate the structured rules below now state properly, so
   *  only a customised blob is printed (see instructionItems). */
  instructions?: string;
  /** admit_cards.created_at — printed as "Generated On". */
  createdAt: string;
}

const rootStyle: React.CSSProperties = {
  width: "210mm",
  minHeight: "297mm",
  background: "#ffffff",
  color: BLACK,
  fontFamily: FONT,
  fontSize: "11px",
  lineHeight: 1.4,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  boxSizing: "border-box",
  position: "relative",
  // Stacking context so the negative-z watermark paints above the white
  // background but behind all card content (and survives html2canvas).
  isolation: "isolate",
};

/** True when a hex colour is too light to print on white (e.g. a white-ish
 *  brand accent) — callers fall back to INK so the pill/rule stay visible.
 *  `threshold` (default 210) can be tightened for small text: at 120 even a
 *  mid-tone accent (which greyscales to ~50% grey) is refused, so the
 *  instruction numbers always print dark and clean in B&W. */
function isWashoutColor(hex: string, threshold = 210): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > threshold;
}

/** Big association watermark behind the card — the official seal.
 *  Uses the super-admin's uploaded image when set, otherwise the classic
 *  text crest built from the short/association names.
 *  Sized DOWN on request: 130mm wide (was 200mm — the seal ran off both
 *  page edges) at 40% opacity, so content stays the focus while the seal
 *  still reads on screen AND in the printed PDF (a 5% seal vanished on
 *  print). Card sections paint no white over it, so the seal reads as one
 *  continuous graphic behind the whole page — content (z-index 1) still
 *  paints on top. The text-crest fallback is scaled to match (90px). */
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
          opacity: 0.4,
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
          // maxWidth:none — Tailwind preflight's `img{max-width:100%}` would
          // clamp this to the abs-wrapper's available width (~105mm) and the
          // seal would never reach its full size.
          style={{ width: "130mm", maxWidth: "none", height: "auto", display: "block" }}
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
        opacity: 0.4,
        textAlign: "center",
        pointerEvents: "none",
        whiteSpace: "nowrap",
        userSelect: "none",
      }}
    >
      <div
        style={{
          fontSize: "90px",
          fontWeight: 700,
          letterSpacing: "9px",
          lineHeight: 1,
          border: `5px solid ${BLACK}`,
          padding: "12px 22px 9px",
        }}
      >
        {brand.brandShort || "BMA"}
      </div>
      <div style={{ fontSize: "17px", fontWeight: 700, letterSpacing: "2px", marginTop: "8px" }}>
        {(brand.brandName || "Bangladesh Madrasah Association").toUpperCase()}
      </div>
      <div style={{ fontSize: "14px", letterSpacing: "1.5px", marginTop: "4px" }}>
        {brand.brandNameBn || "বাংলাদেশ মাদ্রাসা এসোসিয়েশন"}
      </div>
    </div>
  );
}

/** Date of Birth grid value — "04 Jul 2005" / "০৪ জুল ২০০৫". */
function formatDob(iso: string, bn: boolean): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(bn ? "bn-BD" : "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Instruction list numbers — "1." (en) / "১." (bn), like the NU card. */
function listNumber(i: number, bn: boolean): string {
  const n = String(i + 1);
  return (bn ? n.replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]) : n) + ".";
}

/** "Thursday, 04 July 2024, 12:00" — footer Generated On line. */
function formatGenerated(iso: string, bn: boolean): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString(bn ? "bn-BD" : "en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const time = d.toLocaleTimeString(bn ? "bn-BD" : "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${date}, ${time}`;
  } catch {
    return iso;
  }
}

/** "04.07.2024 12:00" — short stamp under the verify QR (Bengali digits in bn). */
function formatStamp(iso: string, bn: boolean): string {
  const bnDigits = (s: string) =>
    bn ? s.replace(/\d/g, (x) => "০১২৩৪৫৬৭৮৯"[Number(x)]) : s;
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return bnDigits(`${day}.${month}.${d.getFullYear()} ${hh}:${mm}`);
  } catch {
    return iso;
  }
}

/** Bordered QR box — used top-right (masthead) and in the verify column.
 *
 *  PRINT CONTRACT: the frame (border + padding + white fill) lives on the
 *  INNER element, never on an `inline-block` wrapper. html2canvas 1.4.1
 *  silently skips an <img> whose direct parent is `inline-block` WITH a
 *  painted background/border — which is exactly why both QRs rendered in
 *  the preview but came out as empty boxes in every downloaded PDF, while
 *  the flex/block-framed images (photo, logo, watermark) printed fine.
 *  Wrapper keeps only `display:inline-block` + `line-height:0` so the box
 *  still hugs the QR. `content-box` is explicit because Tailwind preflight
 *  would otherwise make the frame eat into the 84px image. */
function QrBox({ dataUrl, size }: { dataUrl: string; size: number }) {
  const frame: React.CSSProperties = {
    boxSizing: "content-box",
    border: `1px solid ${INK}`,
    padding: "3px",
    background: "#ffffff",
  };
  return (
    <div style={{ display: "inline-block", lineHeight: 0 }}>
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl}
          alt="QR"
          crossOrigin="anonymous"
          style={{ width: `${size}px`, height: `${size}px`, display: "block", ...frame }}
        />
      ) : (
        <div
          style={{
            width: `${size}px`,
            height: `${size}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "11px",
            color: MUTE,
            ...frame,
          }}
        >
          QR
        </div>
      )}
    </div>
  );
}

/** One row of the candidate grid: one or two (label, value) pairs.
 *  Label cell is fixed 150px, value cells flex — all rules #111. */
function GridRow({
  pairs,
  last,
}: {
  pairs: Array<{ label: string; value: string }>;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        borderBottom: last ? undefined : CELL,
      }}
    >
      {pairs.map((p, i) => (
        <React.Fragment key={`${p.label}-${i}`}>
          <div
            style={{
              width: "142px",
              flexShrink: 0,
              boxSizing: "border-box",
              padding: "4px 8px",
              borderRight: CELL,
              fontSize: "11px",
              fontWeight: 700,
              lineHeight: 1.3,
              color: INK,
              display: "flex",
              alignItems: "center",
            }}
          >
            {p.label}
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              boxSizing: "border-box",
              padding: "4px 8px",
              borderRight: i < pairs.length - 1 ? CELL : undefined,
              fontSize: "12px",
              fontWeight: 600,
              lineHeight: 1.35,
              color: BLACK,
              wordBreak: "break-word",
              display: "flex",
              alignItems: "center",
            }}
          >
            {p.value}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

/** One row of the subject table — two (code | name · time) pairs, rules #111.
 *  The subject's exam time ("10:00–13:00", from the routine) is pinned to the
 *  RIGHT corner of its name cell; blank when the subject has no routine slot.
 *  Time only (never a date, never wrapped) — it rides inside the existing row
 *  so the 297mm vertical budget is untouched.
 *  `dense` tightens vertical padding on very long subject lists (>6 pairs)
 *  so a 14-subject exam still fits the 297mm page at full size. */
function SubjectRow({
  a,
  b,
  last,
  dense,
}: {
  a?: CardSubject;
  b?: CardSubject;
  last?: boolean;
  dense?: boolean;
}) {
  const pad = dense ? "4px 8px" : "5px 8px";
  const cellFor = (s?: CardSubject, right?: boolean) => {
    // Routine slot: "10:00–13:00" — one side only falls back to that side.
    const time =
      s?.startTime && s?.endTime
        ? `${s.startTime}–${s.endTime}`
        : s?.startTime || s?.endTime || "";
    return (
      <React.Fragment>
        {/* code */}
        <div
          style={{
            width: "68px",
            flexShrink: 0,
            boxSizing: "border-box",
            padding: pad,
            borderRight: CELL,
            fontSize: "12px",
            fontWeight: 700,
            lineHeight: 1.3,
            color: BLACK,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          {s?.code || ""}
        </div>
        {/* name */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            boxSizing: "border-box",
            padding: dense ? "4px 9px" : "5px 9px",
            borderRight: right ? CELL : undefined,
            fontSize: "11px",
            lineHeight: 1.35,
            color: BLACK,
            display: "flex",
            alignItems: "center",
          }}
        >
          <span style={{ flex: 1, minWidth: 0, textAlign: "left", wordBreak: "break-word" }}>
            {s?.name || ""}
          </span>
          {/* Exam time pinned to the right corner of the cell (marginLeft,
              not gap — html2canvas 1.4.1 does not lay out flex gap). */}
          {time ? (
            <span
              style={{
                fontSize: "10px",
                lineHeight: 1.2,
                color: MUTE,
                whiteSpace: "nowrap",
                marginLeft: "8px",
              }}
            >
              {time}
            </span>
          ) : null}
        </div>
      </React.Fragment>
    );
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        boxSizing: "border-box",
        minHeight: "26px",
        borderBottom: last ? undefined : CELL,
      }}
    >
      {cellFor(a, true)}
      {cellFor(b, false)}
    </div>
  );
}

/** One half of the signature box: signature/seal image, a 170px rule and
 *  the caption (role + who signs). Footer bottom-aligns the image stack, so
 *  both halves keep their rules on the same line. */
function SignatureSlot({
  image,
  title,
  sub,
  divide,
}: {
  image?: string | null;
  title: string;
  sub: string;
  /** true for the left half — draws the vertical divider. */
  divide?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        boxSizing: "border-box",
        padding: "7px 12px 8px",
        borderRight: divide ? CELL : undefined,
        textAlign: "center",
      }}
    >
      <div
        style={{
          height: "32px",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          marginBottom: "3px",
        }}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            crossOrigin="anonymous"
            style={{ maxHeight: "32px", maxWidth: "170px", objectFit: "contain", display: "block" }}
          />
        ) : null}
      </div>
      <div style={{ width: "170px", maxWidth: "88%", borderTop: `1px solid ${INK}`, margin: "0 auto" }} />
      <div
        style={{
          fontSize: "12px",
          fontWeight: 700,
          color: BLACK,
          marginTop: "5px",
          lineHeight: 1.3,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: "10px",
          color: MUTE,
          marginTop: "2px",
          lineHeight: 1.35,
          wordBreak: "break-word",
        }}
      >
        {sub}
      </div>
    </div>
  );
}

/** Flexible section gap: absorbs ALL free space (footer pins to the page
 *  bottom) but never collapses below 3mm, so sections never touch even
 *  when the worst-case content fills the 297mm page. */
function Gap() {
  return <div style={{ flex: "1 1 auto", minHeight: "3mm" }} />;
}

export function AdmitCardTemplate({ view }: { view: CardView }) {
  const bn = view.lang === "bn";

  // Association branding — same source as the landing page.
  const { data: brandData } = useBranding();
  const brand: BrandingSettings = { ...BRANDING_DEFAULTS, ...(brandData ?? {}) };
  const assocBn = brand.brandNameBn || "বাংলাদেশ মাদ্রাসা এসোসিয়েশন";
  const brandShort = brand.brandShort || "BMA";

  /** Literal accent hex — resolved here (never var(--brand-accent)) so the
   *  fill survives html2canvas AND the print window, which receives a bare
   *  outerHTML clone with no globals.css. Invalid accent → near-black.
   *  `accentInk` additionally refuses a wash-out accent for print. */
  const accentHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test((brand.accentColor || "").trim())
    ? brand.accentColor.trim()
    : "#18181b";
  const accentInk = isWashoutColor(accentHex) ? INK : accentHex;
  /** Small text (instruction numbers) needs a stricter, darker colour than a
   *  2px rule: anything that greyscales lighter than ~50% becomes INK so the
   *  numbered list stays black and clean on a B&W printer. */
  const numInk = isWashoutColor(accentHex, 120) ? INK : accentHex;

  /** Chrome strings follow the active language. */
  const L = (en: string, b: string) => (bn ? b : en);

  const sessionLabel = view.sessionName || view.academicYear || "";

  // Pair subjects up for the 2-pair table; pad the last row when odd.
  const subjectRows: Array<[CardSubject | undefined, CardSubject | undefined]> = [];
  for (let i = 0; i < view.subjects.length; i += 2) {
    subjectRows.push([view.subjects[i], view.subjects[i + 1]]);
  }

  const centerText = [view.centerCode ? `(${view.centerCode})` : "", view.centerName || "—"]
    .filter(Boolean)
    .join(" ");

  const collegeText = view.institutionCode
    ? `${view.institutionCode}-${view.institutionName}`
    : view.institutionName || "—";

  const classNameFull = `${view.className}${
    view.section && view.section !== "—" ? ` / ${view.section}` : ""
  }`;

  // ── Candidate grid — NU arrangement: label | value | label | value.
  const gridRows: Array<Array<{ label: string; value: string }>> = [
    [
      { label: L("Examination Code", "পরীক্ষার কোড"), value: view.examCode || view.institutionCode || "—" },
      { label: L("Roll No.", "রোল নম্বর"), value: view.examRoll || "—" },
    ],
    [
      { label: L("Name of Examinee", "পরীক্ষার্থীর নাম"), value: view.studentName || "—" },
      { label: L("Registration No.", "নিবন্ধন নম্বর"), value: view.registrationNumber || "—" },
    ],
    [
      { label: L("Father's Name", "পিতার নাম"), value: view.fatherName || "—" },
      { label: L("Session", "সেশন"), value: sessionLabel || "—" },
    ],
    [
      { label: L("Mother's Name", "মাতার নাম"), value: view.motherName || "—" },
      { label: L("Date of Birth", "জন্ম তারিখ"), value: formatDob(view.dob || "", bn) },
    ],
    [
      { label: L("Class / Section", "শ্রেণি / সেকশন"), value: classNameFull || "—" },
      { label: L("Class Roll", "ক্লাস রোল"), value: view.classRoll || "—" },
    ],
    [{ label: L("College Code & Name", "কলেজ কোড ও নাম"), value: collegeText }],
    [{ label: L("Center Code & Name", "কেন্দ্র কোড ও নাম"), value: centerText }],
  ];

  // ── Instructions — numbered list (structured rules + custom note).
  const prepRules = [
    L("Report 30 minutes early with the admit card.", "প্রবেশপত্রসহ ৩০ মিনিট আগে পৌঁছান।"),
    L("Photo ID is mandatory.", "পরিচয়পত্র আনা বাধ্যতামূলক।"),
    L("Sit at your allotted seat only.", "নির্ধারিত আসনে বসুন।"),
  ];
  const hallRules = [
    L("Switch off mobile phones and electronic devices.", "মোবাইল ও ইলেকট্রনিক যন্ত্র বন্ধ রাখুন।"),
    L("Use only the supplied answer sheets.", "নির্ধারিত উত্তরপত্রে লিখুন।"),
    L("Do not leave the hall without permission.", "অনুমতি ছাড়া কক্ষ ত্যাগ করবেন না।"),
  ];
  const violationRules = [
    L("Malpractice cancels the result.", "অসদুপায়ে ফলাফল বাতিল হবে।"),
    L("Caught candidates are barred from re-sitting.", "ধরা পড়লে পুনরায় পরীক্ষা নিষিদ্ধ।"),
    L("The Controller's decision is final.", "পরীক্ষা নিয়ন্ত্রকের সিদ্ধান্ত চূড়ান্ত।"),
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

  const instructionItems = [...prepRules, ...hallRules, ...violationRules, ...noteLines];
  /** Long custom notes (12+ lines) tighten the list so the footer still
   *  lands inside 297mm — font size stays 10px, only leading/margins trim. */
  const denseInstructions = instructionItems.length > 11;

  // Masthead logo removed on request — the institution's name is set in type
  // at the centre of the masthead and the photo box anchors the left edge.

  return (
    <div lang={view.lang} className="admit-card-page" style={rootStyle}>
      <Watermark brand={brand} />

      {/* ── 1. White masthead: photo | names | QR ─────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: "4mm 11mm 0",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Left: student photo box (logo removed on request) */}
          <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <div
              style={{
                boxSizing: "content-box",
                width: "88px",
                height: "112px",
                border: RULE,
                background: "#f4f4f5",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {view.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={view.photo}
                  alt={L("Photo", "ছবি")}
                  crossOrigin="anonymous"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "center top",
                    display: "block",
                  }}
                />
              ) : (
                <span style={{ fontSize: "11px", color: MUTE }}>{L("Photo", "ছবি")}</span>
              )}
            </div>
          </div>

          {/* Centre: association overline · institution · exam · period */}
          <div style={{ flex: 1, minWidth: 0, textAlign: "center", padding: "0 10px" }}>
            <div
              style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: MUTE,
                lineHeight: 1.2,
                wordBreak: "break-word",
              }}
            >
              {L(
                brand.brandName || "Bangladesh Madrasah Association",
                brand.brandNameBn || assocBn
              )}
            </div>
            <div
              style={{
                fontSize: "21px",
                fontWeight: 800,
                color: BLACK,
                lineHeight: 1.15,
                letterSpacing: "0.2px",
                marginTop: "3px",
                wordBreak: "break-word",
              }}
            >
              {view.institutionName}
            </div>
            <div
              style={{
                fontSize: "12.5px",
                fontWeight: 700,
                color: INK,
                lineHeight: 1.3,
                marginTop: "4px",
                wordBreak: "break-word",
              }}
            >
              {view.examName}
            </div>
            {view.examPeriod ? (
              <div style={{ fontSize: "10.5px", color: MUTE, marginTop: "3px", lineHeight: 1.3 }}>
                {view.examPeriod}
              </div>
            ) : null}
          </div>

          {/* Right: verify QR (top-right, like NU) */}
          <div style={{ flexShrink: 0 }}>
            <QrBox dataUrl={view.qrDataUrl} size={84} />
          </div>
        </div>

        {/* Centred "Admit Card" pill — bordered, never a filled band */}
        <div style={{ textAlign: "center", marginTop: "8px" }}>
          <span
            style={{
              display: "inline-block",
              border: `1.5px solid ${accentInk}`,
              borderRadius: "999px",
              padding: "4px 20px",
              fontSize: "12.5px",
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: BLACK,
              background: "#ffffff",
              lineHeight: 1.2,
              boxSizing: "border-box",
            }}
          >
            {L("Admit Card", "প্রবেশপত্র")}
          </span>
        </div>

        {/* Thin accent rule closes the masthead */}
        <div style={{ height: "2px", background: accentInk, marginTop: "8px" }} />
      </div>

      <Gap />

      {/* ── 2. Candidate details grid — fully bordered ─────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          margin: "0 11mm",
          border: RULE,
          boxSizing: "border-box",
          // No white fill: the watermark must read continuously behind the
          // whole card (text paints on top — z-index 1 keeps it legible).
          flexShrink: 0,
        }}
      >
        {gridRows.map((pairs, i) => (
          <GridRow key={i} pairs={pairs} last={i === gridRows.length - 1} />
        ))}
      </div>

      <Gap />

      {/* ── 3. Subjects — header row + 2 pairs per row ─────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          margin: "0 11mm",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            border: RULE,
            borderRadius: 0,
            overflow: "hidden",
            // Transparent so the seal watermark shows through the table.
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              padding: "5px 9px",
              background: SHADE,
              borderBottom: CELL,
              textAlign: "center",
              fontSize: "11.5px",
              fontWeight: 800,
              letterSpacing: "0.04em",
              color: BLACK,
            }}
          >
            {L("Subject Code & name", "বিষয় কোড ও নাম")}
          </div>
          {view.subjects.length === 0 ? (
            <div
              style={{
                padding: "14px",
                textAlign: "center",
                fontSize: "12px",
                color: MUTE,
              }}
            >
              {L("No subjects scheduled for this class.", "এই শ্রেণির জন্য কোনো বিষয় নির্ধারিত হয়নি।")}
            </div>
          ) : (
            subjectRows.map(([a, b], i) => (
              <SubjectRow
                key={i}
                a={a}
                b={b}
                last={i === subjectRows.length - 1}
                dense={subjectRows.length > 6}
              />
            ))
          )}
        </div>
      </div>

      <Gap />

      {/* ── 4. Signature box — Principal | Controller ──────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          margin: "0 11mm",
          display: "flex",
          border: RULE,
          boxSizing: "border-box",
          // Transparent — watermark reads through, signature rules stay #111.
          flexShrink: 0,
        }}
      >
        <SignatureSlot
          image={view.principalSignature}
          title={L("Seal & Signature of Principal", "অধ্যক্ষের সিল ও স্বাক্ষর")}
          sub={view.institutionName}
          divide
        />
        <SignatureSlot
          image={brand.mdSignature}
          title={L("Controller of Examinations", "পরীক্ষা নিয়ন্ত্রক")}
          sub={L(
            `Managing Director, ${brandShort} Association`,
            `নির্বাহী পরিচালক, ${assocBn}`
          )}
        />
      </div>

      <Gap />

      {/* ── 5. Instructions (numbered) + verify column ─────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          margin: "0 11mm",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: "12px" }}>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 800,
                color: BLACK,
                letterSpacing: "0.02em",
                marginBottom: "5px",
              }}
            >
              {L("Instructions to Candidates", "পরীক্ষার্থীদের জন্য নির্দেশনা")}
            </div>
            {instructionItems.map((t, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  fontSize: "10px",
                  lineHeight: denseInstructions ? 1.3 : 1.4,
                  color: INK,
                  marginBottom: denseInstructions ? "1px" : "1.5px",
                  wordBreak: "break-word",
                }}
              >
                <span style={{ width: "22px", flexShrink: 0, fontWeight: 700, color: numInk }}>
                  {listNumber(i, bn)}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>{t}</span>
              </div>
            ))}
          </div>
          {/* Right: verify QR + controller + date (NU bottom-right) */}
          <div style={{ width: "130px", flexShrink: 0, textAlign: "center", paddingTop: "2px" }}>
            <QrBox dataUrl={view.qrDataUrl} size={84} />
            <div
              style={{
                fontSize: "9.5px",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: BLACK,
                marginTop: "6px",
                lineHeight: 1.3,
              }}
            >
              {L("Controller of Examinations", "পরীক্ষা নিয়ন্ত্রক")}
            </div>
            <div style={{ fontSize: "9.5px", color: MUTE, marginTop: "2px" }}>
              {formatStamp(view.createdAt, bn)}
            </div>
          </div>
        </div>
      </div>

      <Gap />

      {/* ── 6. Footer — ID No + note + Generated On ────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          margin: "0 11mm",
          padding: "3mm 0 5mm",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: "11.5px", fontWeight: 800, color: BLACK }}>
          {L("ID No", "আইডি নং")}: {view.registrationNumber || view.key.slice(0, 8)}
        </div>
        <div style={{ fontSize: "10px", color: INK, marginTop: "3px", lineHeight: 1.4 }}>
          {L(
            "Note: This document contains the digital signature of the Controller of Examinations.",
            "নোট: এই নথিতে পরীক্ষা নিয়ন্ত্রকের ডিজিটাল স্বাক্ষর অন্তর্ভুক্ত।"
          )}
        </div>
        <div style={{ borderTop: `1px solid ${INK}`, margin: "7px 0 5px" }} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "9.5px",
            color: MUTE,
            lineHeight: 1.4,
          }}
        >
          <span>
            {L("Generated On", "তৈরি হয়েছে")}: {formatGenerated(view.createdAt, bn)}
          </span>
          <span>
            {L("This is a computer-generated admit card.", "এটি কম্পিউটার-উৎপন্ন প্রবেশপত্র।")}
          </span>
        </div>
      </div>
    </div>
  );
}
