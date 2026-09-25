"use client";
import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useExamsFull } from "@/lib/storage/exams";
import { useResultsByExam, useProcessExamResults } from "@/lib/storage/results";
import { useToast } from "@/components/ui/toast";
import { useLang } from "@/contexts/language-context";
import { Play, CheckCircle, AlertCircle } from "lucide-react";
import type { Result } from "@/lib/types";

export function MarksProcessPanel() {
  const { lang } = useLang();
  const isBn = lang === "bn";
  const { toast } = useToast();
  const { data: exams = [] } = useExamsFull();

  const [examId, setExamId] = useState("");
  const processResults = useProcessExamResults();
  const { data: results = [], isLoading } = useResultsByExam(examId);

  const exam = useMemo(() => exams.find((e) => e.id === examId), [exams, examId]);

  const stats = useMemo(() => {
    if (!examId) return { total: 0, processed: 0, draft: 0 };
    return {
      total: results.length,
      processed: results.filter((r) => r.status !== "DRAFT").length,
      draft: results.filter((r) => r.status === "DRAFT").length,
    };
  }, [examId, results]);

  const handleProcess = async () => {
    if (!examId) return;
    try {
      const result = await processResults.mutateAsync(examId);
      toast("success", `${isBn ? "প্রক্রিয়া সম্পন্ন" : "Results processed"}: ${result.processed} ${isBn ? "জন" : "students"}`);
    } catch (e: any) {
      toast("error", e.message || "Processing failed");
    }
  };

  const card = "bg-white border border-zinc-200 rounded-md shadow-sm";

  return (
    <div className="space-y-6">
      <div className={card}>
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2">
          <Play className="h-4 w-4 text-brand-accent" />
          <h3 className="text-sm font-semibold text-zinc-900">
            {isBn ? "পরিসংখ্যান প্রক্রিয়া" : "Process Results"}
          </h3>
        </div>
        <div className="p-4 flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <label className="block text-[11px] mb-1.5 text-zinc-600">{isBn ? "পরীক্ষা" : "Exam"}</label>
            <Select value={examId} onChange={(e) => setExamId(e.target.value)}
              options={[{ label: isBn ? "পরীক্ষা নির্বাচন করুন" : "Select exam", value: "" }, ...exams.map(e => ({ label: e.name, value: e.id }))]}
              placeholder={isBn ? "পরীক্ষা নির্বাচন করুন" : "Select exam"} />
          </div>
          <Button size="sm" onClick={handleProcess} disabled={processResults.isPending || !examId}>
            <Play className="h-3.5 w-3.5 mr-1" /> {isBn ? "পরিসংখ্যান প্রক্রিয়া" : "Process Results"}
          </Button>
        </div>
      </div>

      {examId && (
        <>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: isBn ? "প্রক্রিয়াকৃত" : "Processed", value: stats.processed, icon: CheckCircle },
              { label: isBn ? "ড্রাফ" : "Draft", value: stats.draft, icon: AlertCircle },
              { label: isBn ? "মোট ফলাফল" : "Total Results", value: stats.total, icon: AlertCircle },
            ].map((s) => (
              <div key={s.label} className={card} >
                <div className="px-4 py-3 flex items-center gap-3">
                  <s.icon className="h-5 w-5 text-brand-accent" />
                  <div>
                    <p className="text-lg font-bold text-zinc-900">{s.value}</p>
                    <p className="text-[11px] text-zinc-500">{s.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className={card}>
            <div className="px-5 py-4 border-b border-zinc-100">
              <h3 className="text-sm font-semibold text-zinc-900">
                {isBn ? "প্রক্রিয়াকৃত ফলাফল" : "Processed Results"}
              </h3>
            </div>
            {isLoading ? (
              <div className="p-8 text-center text-sm text-zinc-500">{isBn ? "লোড হচ্ছে..." : "Loading..."}</div>
            ) : results.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">{isBn ? "কোনো ফলাফল পাওয়া যায়নি" : "No results yet"}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] uppercase">{isBn ? "শিক্ষার্থী" : "Student"}</TableHead>
                    <TableHead className="text-[10px] uppercase">{isBn ? "গ্রেড" : "Grade"}</TableHead>
                    <TableHead className="text-[10px] uppercase">{isBn ? "পার্সেন্টেজ" : "Pct"}</TableHead>
                    <TableHead className="text-[10px] uppercase">{isBn ? "পাস" : "Pass"}</TableHead>
                    <TableHead className="text-[10px] uppercase">{isBn ? "বৃত্তি" : "Scholarship"}</TableHead>
                    <TableHead className="text-[10px] uppercase">{isBn ? "স্থিতি" : "Status"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.slice(0, 50).map((r: Result) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm text-zinc-800">{r.studentName}</TableCell>
                      <TableCell><Badge variant="secondary">{r.grade}</Badge></TableCell>
                      <TableCell className="text-[11px] text-zinc-600">{r.percentage}%</TableCell>
                      <TableCell>{r.pass ? <Badge>Pass</Badge> : <Badge>Fail</Badge>}</TableCell>
                      <TableCell>
                        {r.scholarshipStatus === "TALENT_POOL" ? (
                          <Badge className="bg-amber-100 text-amber-900 border-amber-300">{isBn ? "ট্যালেন্টপুল" : "Talentpool"}</Badge>
                        ) : r.scholarshipStatus === "GENERAL" ? (
                          <Badge className="bg-sky-100 text-sky-900 border-sky-300">{isBn ? "সাধারণ" : "General"}</Badge>
                        ) : r.scholarshipStatus === "PENDING" ? (
                          <Badge variant="outline">{isBn ? "নিষ্ক্রিয়" : "Pending"}</Badge>
                        ) : (
                          <Badge variant="outline">—</Badge>
                        )}
                      </TableCell>
                      <TableCell><Badge>{r.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
