"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { initializeDemoData } from "@/lib/storage/seed";
import { getResults } from "@/lib/storage/results";
import { getStudents } from "@/lib/storage/students";
import { Result } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Download, Printer, Award, CheckCircle, XCircle } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";

export default function ResultPage() {
  const { theme } = useTheme();
  const { t } = useLang();
  const isDark = theme === "dark";
  const [searchType, setSearchType] = useState<'dob' | 'roll'>('dob');
  const [regNumber, setRegNumber] = useState("");
  const [dob, setDob] = useState("");
  const [roll, setRoll] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => { initializeDemoData(); }, []);

  const handleSearch = () => {
    const results = getResults().filter(r => r.status === 'PUBLISHED');
    const students = getStudents();
    const found = results.find(r => {
      const regMatch = r.registrationNumber === regNumber || r.registrationNumber.toLowerCase() === regNumber.toLowerCase();
      if (searchType === 'dob') {
        if (!regMatch) return false;
        const student = students.find(s => s.id === r.studentId);
        return student && student.dateOfBirth === dob;
      }
      return regMatch && r.roll === roll;
    });
    setResult(found || null);
    setSearched(true);
  };

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#080808]" : "bg-gray-50"}`}>
      <header className={`border-b backdrop-blur-xl ${isDark ? "border-white/[0.06] bg-[#080808]/80" : "border-gray-200 bg-white/80"}`}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg font-bold text-sm ${isDark ? "bg-white text-black" : "bg-black text-white"}`}>B</div>
            <span className={`text-sm font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}>{t("brand")}</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/verify-certificate" className={`text-xs ${isDark ? "text-zinc-500 hover:text-zinc-300" : "text-gray-500 hover:text-gray-900"}`}>{t("nav.verifyCertificate")}</Link>
            <Link href="/login" className={`text-xs ${isDark ? "text-zinc-500 hover:text-zinc-300" : "text-gray-500 hover:text-gray-900"}`}>{t("nav.signIn")}</Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center mb-8">
          <h1 className={`text-2xl font-bold tracking-tight mb-2 ${isDark ? "text-zinc-100" : "text-gray-900"}`}>Scholarship Examination Result</h1>
          <p className={`text-sm ${isDark ? "text-zinc-500" : "text-gray-500"}`}>Search for published results using your registration details.</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSearchType('dob')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${searchType === 'dob' ? 'bg-white text-black' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Registration + Date of Birth
              </button>
              <button
                onClick={() => setSearchType('roll')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${searchType === 'roll' ? 'bg-white text-black' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Registration + Roll
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Registration Number</label>
                <Input
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                  placeholder="e.g. APP-2026-0001"
                />
              </div>
              {searchType === 'dob' ? (
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Date of Birth</label>
                  <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Exam Roll</label>
                  <Input value={roll} onChange={(e) => setRoll(e.target.value)} placeholder="e.g. 1" />
                </div>
              )}
              <Button onClick={handleSearch} className="w-full">
                <Search className="h-4 w-4 mr-2" /> Search Result
              </Button>
            </div>
          </CardContent>
        </Card>

        {searched && !result && (
          <div className="mt-6 text-center py-8">
            <XCircle className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">No result found. Please check your details and try again.</p>
          </div>
        )}

        {result && (
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Result</CardTitle>
                <Badge status={result.pass ? 'ACTIVE' : 'REJECTED'}>{result.pass ? 'Passed' : 'Failed'}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Student Name', value: result.studentName },
                  { label: 'Institution', value: result.institutionName },
                  { label: 'Class', value: result.className },
                  { label: 'Exam', value: result.examName },
                  { label: 'Roll', value: result.roll },
                  { label: 'Registration No', value: result.registrationNumber },
                ].map(item => (
                  <div key={item.label}>
                    <span className="text-[10px] text-zinc-600 uppercase tracking-wider">{item.label}</span>
                    <p className="text-sm text-zinc-200 mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/[0.06] pt-4">
                <h4 className="text-xs text-zinc-500 mb-2">Subject-wise Marks</h4>
                <div className="space-y-1">
                  {result.subjectMarks.map(sm => (
                    <div key={sm.subjectId} className="flex items-center justify-between text-sm py-1">
                      <span className="text-zinc-400">{sm.subjectName}</span>
                      <span className="text-zinc-200 font-medium">{sm.marks} / {sm.fullMarks}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/[0.06] pt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="text-center p-3 rounded-lg bg-white/[0.02]">
                  <span className="text-[10px] text-zinc-600 uppercase">Total</span>
                  <p className="text-lg font-bold text-zinc-100">{result.totalMarks}/{result.totalFullMarks}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-white/[0.02]">
                  <span className="text-[10px] text-zinc-600 uppercase">Percentage</span>
                  <p className="text-lg font-bold text-zinc-100">{result.percentage.toFixed(1)}%</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-white/[0.02]">
                  <span className="text-[10px] text-zinc-600 uppercase">Grade</span>
                  <p className="text-lg font-bold text-zinc-100">{result.grade}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-white/[0.02]">
                  <span className="text-[10px] text-zinc-600 uppercase">Position</span>
                  <p className="text-lg font-bold text-zinc-100">#{result.position}</p>
                </div>
              </div>

              {result.scholarshipStatus === 'ELIGIBLE' && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm text-emerald-300">Congratulations! You are eligible for the scholarship.</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1"><Download className="h-4 w-4 mr-2" /> Download</Button>
                <Button variant="outline" size="sm" className="flex-1"><Printer className="h-4 w-4 mr-2" /> Print</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
