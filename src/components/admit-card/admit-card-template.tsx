"use client";

import { formatDate } from "@/lib/storage/storage";

/**
 * The designed admit card — one fixed A4 page (210mm × 297mm).
 *
 * Everything is styled INLINE on purpose: html2canvas rasterises it for the
 * bulk PDF and the print window receives a plain outerHTML clone with no
 * Tailwind sheet, so the design must be self-contained.
 *
 * Layout mirrors the reference: dashed frame, logo | titles | photo header,
 * black pill, two label:value columns, boxed Roll No., subject list with the
 * routine date/start–end time beside each subject, QR + BMA Secretary
 * signature, gray directions box. Font: Courier New (typewriter face).
 */

const FONT = "'Courier New', Courier, 'Tiro Bangla', 'Noto Sans Bengali', monospace";

export interface CardSubject {
  code: string; // "101", "102"… auto-numbered per class in routine order
  name: string;
  date?: string; // YYYY-MM-DD from the exam routine, '' when unscheduled
  startTime?: string;
  endTime?: string;
}

export interface CardView {
  key: string; // admit_cards.id — unique per card, used as ref key
  institutionName: string;
  institutionCode?: string;
  institutionLogo?: string | null;
  examName: string;
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
  instructions?: string;
}

function timeText(s: CardSubject): string {
  const st = s.startTime;
  const et = s.endTime;
  if (st && et) return `${st}–${et}`;
  if (st) return `${st}`;
  if (et) return `–${et}`;
  return "";
}

function subjectTime(s: CardSubject): string {
  const parts: string[] = [];
  if (s.date) {
    try {
      parts.push(formatDate(s.date).split(",")[0]); // "Dec 31"
    } catch {
      parts.push(s.date);
    }
  }
  const t = timeText(s);
  if (t) parts.push(t);
  return parts.join(" · ");
}

function Row({ label, value, boxed, labelWidth }: {
  label: string;
  value: string;
  boxed?: boolean;
  labelWidth?: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", marginBottom: "4px" }}>
      <span style={{
        fontWeight: 700, fontSize: "11px", whiteSpace: "nowrap",
        width: labelWidth ? `${labelWidth}px` : undefined, marginRight: "6px",
      }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: "11px", marginRight: "6px" }}>:</span>
      <span style={{
        fontSize: "12px", minWidth: 0, wordBreak: "break-word",
        ...(boxed ? {
          display: "inline-block", border: "1.5px solid #000", padding: "1px 10px",
          fontWeight: 700, letterSpacing: "2px",
        } : {}),
      }}>{value}</span>
    </div>
  );
}

export function AdmitCardTemplate({ view }: { view: CardView }) {
  const instructions = (view.instructions ||
    "1. The examinee must bring the Registration Card along with the Admit Card in the exam hall.\n" +
    "2. The examinee must sign the attendance sheet for each subject in the exam hall.\n" +
    "১. পরীক্ষার্থীকে নিবন্ধন কার্ডসহ প্রবেশপত্র পরীক্ষাকক্ষে আনতে হবে।\n" +
    "২. প্রতিটি বিষয়ের পরীক্ষায় উপস্থিতি শীটে স্বাক্ষর করতে হবে।"
  ).split("\n").filter(Boolean);

  return (
    <div
      className="admit-card-page"
      style={{
        width: "210mm", height: "297mm", boxSizing: "border-box",
        background: "#ffffff", color: "#000000", fontFamily: FONT,
        position: "relative", overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Dashed frame */}
      <div style={{
        position: "absolute", inset: "6mm", border: "2px dashed #000",
        pointerEvents: "none", boxSizing: "border-box",
      }} />

      <div style={{
        position: "relative", height: "100%", boxSizing: "border-box",
        padding: "12mm 13mm 10mm", display: "flex", flexDirection: "column",
      }}>
        {/* ── Header: logo | titles | photo ─────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ width: "64px", height: "64px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {view.institutionLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={view.institutionLogo} alt=""
                crossOrigin="anonymous"
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              />
            ) : (
              <div style={{
                width: "56px", height: "56px", background: "#000", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: "14px", letterSpacing: "1px",
              }}>BMA</div>
            )}
          </div>

          <div style={{ flex: 1, textAlign: "center", padding: "0 8px", minWidth: 0 }}>
            <div style={{ fontSize: "16px", fontWeight: 700, textTransform: "uppercase", lineHeight: 1.25 }}>
              {view.institutionName}
            </div>
            <div style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", marginTop: "3px" }}>
              {view.examName}{view.academicYear ? ` - ${view.academicYear}` : ""}
            </div>
          </div>

          <div style={{
            width: "86px", height: "104px", flexShrink: 0, border: "1.5px solid #000",
            display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
            background: "#fff",
          }}>
            {view.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={view.photo} alt="" crossOrigin="anonymous"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: "11px", color: "#666" }}>PHOTO</span>
            )}
          </div>
        </div>

        {/* ── Pill ──────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", margin: "8px 0 10px" }}>
          <span style={{
            display: "inline-block", background: "#000", color: "#fff",
            borderRadius: "999px", padding: "3px 26px", fontSize: "12.5px", fontWeight: 700,
          }}>Admit Card / প্রবেশপত্র</span>
        </div>

        {/* ── Fields: two columns ───────────────────────────────── */}
        <div style={{ display: "flex", flexWrap: "wrap", marginBottom: "6px" }}>
          <div style={{ width: "calc(50% - 8px)", marginRight: "16px" }}>
            <Row label="Roll No." value={view.examRoll || "—"} boxed />
            <Row label="Reg. No." value={view.registrationNumber || "—"} />
            <Row label="Session" value={view.sessionName || "—"} />
            <Row label="Class" value={view.className} />
            <Row label="Section" value={view.section || "—"} />
            <Row label="Class Roll" value={view.classRoll || "—"} />
          </div>
          <div style={{ width: "calc(50% - 8px)" }}>
            <Row label="Code No. & Centre" value={`${view.centerCode ? `(${view.centerCode}) ` : ""}${view.centerName || "—"}`} labelWidth={128} />
            <Row label="Code No. & Institution" value={`${view.institutionCode ? `(${view.institutionCode}) ` : ""}${view.institutionName}`} labelWidth={128} />
            <Row label="Name of Examinee" value={view.studentName} labelWidth={128} />
            <Row label="Father's Name" value={view.fatherName || "—"} labelWidth={128} />
            <Row label="Mother's Name" value={view.motherName || "—"} labelWidth={128} />
            <Row label="Date of Birth" value={view.dob && view.dob !== "—" ? formatDate(view.dob) : "—"} labelWidth={128} />
          </div>
        </div>

        {/* ── Subjects: code — NAME, with routine date & time beside ─ */}
        <div style={{ marginTop: "4px" }}>
          <div style={{ fontSize: "11.5px", fontWeight: 700, marginBottom: "6px" }}>
            Code No. &amp; Subject(s) :
          </div>
          {view.subjects.length === 0 ? (
            <div style={{ fontSize: "12px", color: "#555" }}>TBA</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap" }}>
              {view.subjects.map((s) => {
                const t = subjectTime(s);
                return (
                  <div
                    key={`${s.code}-${s.name}`}
                    style={{
                      width: "calc(50% - 8px)", marginRight: "16px", marginBottom: "4px",
                      display: "flex", justifyContent: "space-between", alignItems: "baseline",
                    }}
                  >
                    <span style={{ fontSize: "12px", minWidth: 0, wordBreak: "break-word", marginRight: "8px" }}>
                      {s.code} — {s.name}
                    </span>
                    {t && (
                      <span style={{ fontSize: "10.5px", whiteSpace: "nowrap", flexShrink: 0 }}>
                        {t}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Spacer pushes footer to the bottom ─────────────────── */}
        <div style={{ flex: 1 }} />

        {/* ── QR + Secretary signature ───────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: "8px" }}>
          <div style={{ textAlign: "center" }}>
            {view.qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={view.qrDataUrl} alt="QR" crossOrigin="anonymous"
                style={{ width: "76px", height: "76px" }}
              />
            )}
            <div style={{ fontSize: "8.5px", marginTop: "2px", color: "#333" }}>Scan for result</div>
          </div>

          <div style={{ textAlign: "center", fontSize: "12px" }}>
            <div style={{ width: "62mm", borderBottom: "1.5px dotted #000", margin: "0 0 5px auto", height: "18px" }} />
            <div style={{ fontWeight: 700 }}>সম্পাদক / Secretary</div>
            <div style={{ fontSize: "11px", marginTop: "1px" }}>BMA — Bangladesh Madrasah Association</div>
            <div style={{ fontSize: "11px" }}>বাংলাদেশ মাদ্রাসা এসোসিয়েশন</div>
          </div>
        </div>

        {/* ── Directions box ─────────────────────────────────────── */}
        <div style={{
          marginTop: "8px", background: "#e9e9e9", padding: "5px 8px",
          fontSize: "9.5px", lineHeight: 1.5,
        }}>
          <div style={{ fontWeight: 700, textDecoration: "underline" }}>Directions: / নির্দেশনা :</div>
          {instructions.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      </div>
    </div>
  );
}
