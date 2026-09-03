"use client";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAdmitCards } from "@/lib/storage/admit-cards";
import { FileCheck, Download, Printer, Eye } from "lucide-react";

export default function AdmitCardsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <div className="h-8 w-48 skeleton rounded" />;

  const cards = getAdmitCards();

  return (
    <div>
      <PageHeader title="Admit Cards" description="Manage and generate admit cards for examinations." />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Reg No</TableHead>
              <TableHead>Exam</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Roll</TableHead>
              <TableHead>Center</TableHead>
              <TableHead>Exam Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cards.map(card => (
              <TableRow key={card.id}>
                <TableCell>
                  <p className="text-sm text-zinc-200">{card.studentName}</p>
                  <p className="text-[10px] text-zinc-600">{card.institutionName}</p>
                </TableCell>
                <TableCell className="text-xs text-zinc-500 font-mono">{card.registrationNumber}</TableCell>
                <TableCell className="text-xs text-zinc-500 truncate max-w-[140px]">{card.examName}</TableCell>
                <TableCell className="text-sm text-zinc-400">{card.className}</TableCell>
                <TableCell className="text-sm text-zinc-400">{card.roll}</TableCell>
                <TableCell className="text-xs text-zinc-500 truncate max-w-[120px]">{card.examCenter}</TableCell>
                <TableCell className="text-xs text-zinc-500">{new Date(card.examDate).toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5 text-zinc-500" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="h-3.5 w-3.5 text-zinc-500" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7"><Printer className="h-3.5 w-3.5 text-zinc-500" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
