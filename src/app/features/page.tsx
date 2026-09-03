"use client";
import Link from "next/link";
import { Building2, Users, FileText, ClipboardList, BookOpen, Award, CreditCard, BarChart3, Shield, Bell, Search, Settings } from "lucide-react";

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-[#080808]">
      <header className="fixed top-0 w-full z-50 border-b border-white/[0.06] bg-[#080808]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-black font-bold text-sm">S</div>
            <span className="text-sm font-semibold text-zinc-100">ScholarX</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/about" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">About</Link>
            <Link href="/features" className="text-sm text-zinc-300">Features</Link>
            <Link href="/pricing" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Pricing</Link>
            <Link href="/contact" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Contact</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors px-3 py-1.5">Sign in</Link>
            <Link href="/register" className="text-sm bg-white text-black hover:bg-white/90 px-4 py-1.5 rounded-md font-medium transition-colors">Register</Link>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-6">Platform Features</h1>
            <p className="text-lg text-zinc-500 leading-relaxed">
              Everything you need to manage scholarship examinations, from registration to certificate verification.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: Building2, title: 'Institution Management', desc: 'Register and manage multiple institutions with isolated workspaces, each with their own admin dashboard.' },
              { icon: Users, title: 'Student Registration', desc: 'Bulk student registration with CSV import, export, validation, and class-wise organization.' },
              { icon: FileText, title: 'Exam Management', desc: 'Create and configure scholarship exams with multiple subjects, marking schemes, and scheduling.' },
              { icon: ClipboardList, title: 'Registration System', desc: 'Multi-step registration workflow with payment tracking, verification, and approval.' },
              { icon: BookOpen, title: 'Marks Entry', desc: 'Spreadsheet-style marks entry with keyboard navigation, inline editing, and bulk operations.' },
              { icon: Award, title: 'Result Processing', desc: 'Automatic calculation of totals, percentages, grades, positions, and scholarship eligibility.' },
              { icon: Shield, title: 'Admit Cards', desc: 'Auto-generate official admit cards with QR codes, instructions, and exam center details.' },
              { icon: Award, title: 'Certificates', desc: 'Generate official scholarship certificates with QR verification and customizable templates.' },
              { icon: CreditCard, title: 'Payment Tracking', desc: 'Track registration payments across institutions with transaction history and reporting.' },
              { icon: BarChart3, title: 'Analytics & Reports', desc: 'Comprehensive dashboards with charts, KPIs, and exportable reports.' },
              { icon: Bell, title: 'Notifications', desc: 'Global notification center with real-time alerts for important events.' },
              { icon: Search, title: 'Certificate Verification', desc: 'Public certificate verification portal with QR code scanning support.' },
            ].map(f => (
              <div key={f.title} className="rounded-xl border border-white/[0.06] bg-[#111111] p-5 hover:border-white/[0.1] transition-colors">
                <div className="rounded-lg bg-zinc-800/50 p-2 w-fit mb-3">
                  <f.icon className="h-5 w-5 text-zinc-400" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-100 mb-1">{f.title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-white/[0.06] py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-black font-bold text-xs">S</div>
            <span className="text-sm font-semibold text-zinc-300">ScholarX</span>
          </div>
          <p className="text-xs text-zinc-700">© 2026 ScholarX. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
