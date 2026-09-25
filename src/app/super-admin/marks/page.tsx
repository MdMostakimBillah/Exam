"use client";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useLang } from "@/contexts/language-context";
import { BookOpen } from "lucide-react";

export default function MarksPage() {
  const { lang } = useLang();
  const isBn = lang === "bn";
  const toast = useToast();

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            {isBn ? "নম্বর প্রবেশ" : "Marks Entry"}
          </h1>
          <p className="text-sm mt-1 text-zinc-500">
            {isBn ? "পরীক্ষার নম্বর প্রবেশ, সেটআপ এবং পরিসংখ্যান" : "Enter marks, configure subjects/grading, and process results"}
          </p>
        </div>

        <Tabs defaultValue="setup">
          <TabsList>
            <TabsTrigger value="setup">
              <BookOpen className="h-4 w-4 mr-1" /> {isBn ? "সেটআপ" : "Setup"}
            </TabsTrigger>
            <TabsTrigger value="entry">
              {isBn ? "ডেমো" : "Demo"}
            </TabsTrigger>
            <TabsTrigger value="matrix">
              {isBn ? "ম্যাট্রিক্স" : "Matrix"}
            </TabsTrigger>
            <TabsTrigger value="process">
              {isBn ? "পরিসংখ্যান" : "Process"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="setup">
            <></>
          </TabsContent>
          <TabsContent value="entry">
            <></>
          </TabsContent>
          <TabsContent value="matrix">
            <></>
          </TabsContent>
          <TabsContent value="process">
            <></>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
