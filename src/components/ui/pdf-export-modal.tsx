"use client";
import { useState, useCallback, useMemo } from "react";
import { X, FileDown, Eye, LayoutTemplate, RotateCcw, Check } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { useBranding } from "@/lib/storage/branding";
import { accentPalette, PDF_CENTER_KEYS } from "@/lib/utils/generate-pdf";

export interface PdfColumn {
  header: string;
  key: string;
  visible?: boolean;
}

interface PdfExportModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  columns: PdfColumn[];
  data: Record<string, string | number>[];
  companyName?: string;
  companySubtitle?: string;
  /** Row-data key holding a photo — enables the "include photos" option. */
  imageKey?: string;
  /** Header label for the photo column in the exported PDF. */
  imageHeader?: string;
}

export function PdfExportModal({
  open,
  onClose,
  title: defaultTitle,
  columns: allColumns,
  data,
  companyName,
  companySubtitle,
  imageKey,
  imageHeader,
}: PdfExportModalProps) {
  const { theme } = useTheme();
  const { lang } = useLang();
  const isDark = theme === "dark";
  const isBn = lang === "bn";
  const { data: branding } = useBranding();
  const pal = accentPalette((branding?.accentColor || "").trim());

  const [title, setTitle] = useState(defaultTitle);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");
  const [withPhotos, setWithPhotos] = useState(true);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => new Set(allColumns.filter((c) => c.visible !== false).map((c) => c.key))
  );

  // Photo option only makes sense when at least one row actually has an image.
  const photosAvailable = useMemo(() => {
    if (!imageKey) return false;
    return data.some((row) => String(row[imageKey] ?? "").trim());
  }, [data, imageKey]);

  const toggleKey = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedKeys(new Set(allColumns.map((c) => c.key)));
  }, [allColumns]);

  const clearAll = useCallback(() => {
    setSelectedKeys(new Set());
  }, []);

  const activeColumns = useMemo(
    () => allColumns.filter((c) => selectedKeys.has(c.key)),
    [allColumns, selectedKeys]
  );

  const handleDownload = useCallback(async () => {
    if (activeColumns.length === 0) return;
    const { generatePdf } = await import("@/lib/utils/generate-pdf");
    generatePdf({
      title,
      columns: activeColumns.map((c) => ({ header: c.header, key: c.key })),
      data,
      orientation,
      companyName,
      companySubtitle,
      accent: pal.hex,
      imageKey: withPhotos && photosAvailable ? imageKey : undefined,
      imageHeader: imageHeader || (isBn ? 'ছবি' : 'Photo'),
    });
    onClose();
  }, [title, activeColumns, data, orientation, companyName, companySubtitle, onClose,
      pal.hex, withPhotos, photosAvailable, imageKey, imageHeader, isBn]);

  if (!open) return null;

  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200";
  const subtle = isDark ? "bg-white/[0.03]" : "bg-zinc-50";
  const border = isDark ? "border-white/[0.06]" : "border-zinc-200";
  const text = isDark ? "text-zinc-100" : "text-zinc-900";
  const textMuted = isDark ? "text-zinc-500" : "text-zinc-400";
  const inputBg = isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-50 w-full max-w-5xl max-h-[90vh] flex flex-col rounded-md shadow-2xl ${card}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${border}`}>
          <div>
            <h2 className={`text-base font-semibold ${text}`}>
              {isBn ? 'পিডিএফ অপশন' : 'PDF Options'}
            </h2>
            <p className={`text-[11px] mt-0.5 ${textMuted}`}>
              {allColumns.length} {isBn ? 'কলাম' : 'columns'} · {data.length} {isBn ? 'টি রেকর্ড' : 'records'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={activeColumns.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-[11px] font-medium bg-brand-accent text-brand-accent-fg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Eye className="h-3.5 w-3.5" /> {isBn ? 'প্রিভিউ' : 'Preview'}
            </button>
            <button
              onClick={onClose}
              className={`rounded-md p-1.5 transition-all ${isDark ? "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05]" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: Options */}
          <div className={`w-80 shrink-0 p-5 border-r ${border} overflow-y-auto`}>
            {/* 1. Title */}
            <div className="mb-5">
              <label className={`text-[10px] font-semibold uppercase tracking-wider ${textMuted}`}>
                ① {isBn ? 'তালিকার শিরোনাম' : 'LIST TITLE'}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`w-full mt-2 px-3 py-2 rounded-md text-xs border ${inputBg} ${text} focus:outline-none focus:ring-1 focus:ring-[color:var(--brand-accent)] focus:border-[color:var(--brand-accent)]`}
              />
            </div>

            {/* 2. Orientation */}
            <div className="mb-5">
              <label className={`text-[10px] font-semibold uppercase tracking-wider ${textMuted}`}>
                ② {isBn ? 'পৃষ্ঠার দিক' : 'PAGE ORIENTATION'}
              </label>
              <div className="flex gap-2 mt-2">
                {(["portrait", "landscape"] as const).map((o) => (
                  <button
                    key={o}
                    onClick={() => setOrientation(o)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-[11px] font-medium border transition-all ${
                      orientation === o
                        ? "border-brand-accent bg-brand-accent-soft text-brand-accent"
                        : `${border} ${textMuted} hover:border-brand-accent`
                    }`}
                  >
                    <LayoutTemplate className="h-3.5 w-3.5" />
                    {o === "portrait" ? (isBn ? 'পোর্ট্রেট' : 'Portrait') : (isBn ? 'ল্যান্ডস্কেপ' : 'Landscape')}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Select Columns */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className={`text-[10px] font-semibold uppercase tracking-wider ${textMuted}`}>
                  ③ {isBn ? 'ডেটা কলাম নির্বাচন' : 'SELECT DATA COLUMNS'}
                </label>
                <span className={`text-[10px] ${textMuted}`}>
                  {selectedKeys.size}/{allColumns.length}
                </span>
              </div>
              <div className="flex gap-2 mb-3">
                <button onClick={selectAll} className={`px-3 py-1 rounded-md text-[10px] font-medium border ${border} ${textMuted} hover:border-brand-accent`}>
                  {isBn ? 'সব' : 'All'}
                </button>
                <button onClick={clearAll} className={`px-3 py-1 rounded-md text-[10px] font-medium border ${border} ${textMuted} hover:border-brand-accent`}>
                  {isBn ? 'পরিষ্কার' : 'Clear'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {allColumns.map((col) => {
                  const active = selectedKeys.has(col.key);
                  return (
                    <button
                      key={col.key}
                      onClick={() => toggleKey(col.key)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-[11px] font-medium border transition-all text-left ${
                        active
                          ? "border-brand-accent bg-brand-accent-soft text-brand-accent"
                          : `${border} ${textMuted}`
                      }`}
                    >
                      <div className={`h-3.5 w-3.5 rounded-sm border flex items-center justify-center shrink-0 ${
                        active ? "bg-brand-accent border-brand-accent" : "border-zinc-400"
                      }`}>
                        {active && <Check className="h-2.5 w-2.5 text-brand-accent-fg" />}
                      </div>
                      <span className="truncate">{col.header}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Photos */}
            {photosAvailable && (
              <div>
                <label className={`text-[10px] font-semibold uppercase tracking-wider ${textMuted} block mb-2`}>
                  ④ {isBn ? 'ছবি সহ ডাউনলোড' : 'INCLUDE PHOTOS'}
                </label>
                <button
                  onClick={() => setWithPhotos((v) => !v)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-[11px] font-medium border transition-all text-left ${
                    withPhotos
                      ? "border-brand-accent bg-brand-accent-soft text-brand-accent"
                      : `${border} ${textMuted}`
                  }`}
                >
                  <div className={`h-3.5 w-3.5 rounded-sm border flex items-center justify-center shrink-0 ${
                    withPhotos ? "bg-brand-accent border-brand-accent" : "border-zinc-400"
                  }`}>
                    {withPhotos && <Check className="h-2.5 w-2.5 text-brand-accent-fg" />}
                  </div>
                  <span>{isBn ? 'শিক্ষার্থীর ছবি অন্তর্ভুক্ত করুন' : 'Include student photos'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Right: Preview */}
          <div className={`flex-1 p-5 overflow-y-auto ${subtle}`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${textMuted}`}>
                {isBn ? 'প্রিভিউ' : 'PREVIEW'}
              </span>
              <span className={`text-[10px] ${textMuted}`}>
                A4 · {orientation}
              </span>
            </div>
            <div className={`rounded-md border ${border} bg-white p-4 shadow-sm`}>
              <PdfPreview
                title={title}
                columns={activeColumns}
                data={data}
                orientation={orientation}
                companyName={companyName}
                companySubtitle={companySubtitle}
                pal={pal}
                imageKey={withPhotos && photosAvailable ? imageKey : undefined}
                imageHeader={imageHeader || (isBn ? 'ছবি' : 'Photo')}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-6 py-3 border-t ${border}`}>
          <button
            onClick={clearAll}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-medium border ${border} ${textMuted} hover:border-brand-accent`}
          >
            <RotateCcw className="h-3 w-3" /> {isBn ? 'রিসেট' : 'Reset'}
          </button>
          <button
            onClick={handleDownload}
            disabled={activeColumns.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-md text-[11px] font-medium bg-brand-accent text-brand-accent-fg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <FileDown className="h-3.5 w-3.5" /> {isBn ? 'ডাউনলোড পিডিএফ' : 'Download PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PdfPreview({
  title,
  columns,
  data,
  orientation,
  companyName,
  companySubtitle,
  pal,
  imageKey,
  imageHeader,
}: {
  title: string;
  columns: PdfColumn[];
  data: Record<string, string | number>[];
  orientation: "portrait" | "landscape";
  companyName?: string;
  companySubtitle?: string;
  pal: ReturnType<typeof accentPalette>;
  imageKey?: string;
  imageHeader?: string;
}) {
  const company = companyName || "Bangladesh Madrasah Association";
  const companySub = companySubtitle || "বাংলাদেশ মাদ্রাসা এসোসিয়েশন";
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div className="text-[8px] select-none">
      {/* Header */}
      <div className="text-white px-3 py-2 rounded-t-sm flex justify-between items-start" style={{ backgroundColor: pal.hex }}>
        <div>
          <div className="text-[10px] font-bold">{company}</div>
          <div className="text-[7px] opacity-80">{companySub}</div>
        </div>
        <div className="text-right text-[7px] opacity-80">
          <div>Printed: {dateStr}</div>
          <div>Total: {data.length} records</div>
          <div>A4 · {orientation}</div>
        </div>
      </div>

      {/* Title */}
      <div className="text-center py-2 border-b-2" style={{ borderColor: pal.hex }}>
        <div className="text-[10px] font-bold text-gray-800">{title.toUpperCase()}</div>
      </div>

      {/* Table */}
      <table className="w-full border-collapse mt-2 text-[7px]">
        <thead>
          <tr className="text-white" style={{ backgroundColor: pal.hex }}>
            <th className="px-2 py-1.5 text-center font-bold border" style={{ borderColor: pal.dark }}>#</th>
            {imageKey && (
              <th className="px-2 py-1.5 text-center font-bold border" style={{ borderColor: pal.dark }}>
                {(imageHeader || "Photo").toUpperCase()}
              </th>
            )}
            {columns.map((col) => (
              <th key={col.key} className="px-2 py-1.5 text-center font-bold border" style={{ borderColor: pal.dark }}>
                {col.header.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 8).map((row, idx) => (
            <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? pal.tint : "#ffffff" }}>
              <td className="px-2 py-1.5 text-center align-middle border" style={{ borderColor: pal.light }}>{idx + 1}</td>
              {imageKey && (
                <td className="px-1 py-1 text-center align-middle border" style={{ borderColor: pal.light }}>
                  {String(row[imageKey] ?? "") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={String(row[imageKey])}
                      alt=""
                      className="h-6 w-6 object-cover rounded-sm mx-auto"
                    />
                  ) : null}
                </td>
              )}
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-2 py-1.5 border text-gray-700 align-middle ${
                    PDF_CENTER_KEYS.has(col.key) ? "text-center" : "text-left"
                  }`}
                  style={{ borderColor: pal.light }}
                >
                  {String(row[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {data.length > 8 && (
        <div className="text-center text-[7px] text-gray-400 mt-1">
          ... and {data.length - 8} more records
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-2 border-t border-gray-200 flex justify-between text-[7px] text-gray-400">
        <span>Powered by ScholarX</span>
        <span className="flex gap-8">
          <span>________________ Principal</span>
          <span>________________ Office Seal</span>
        </span>
      </div>
    </div>
  );
}
