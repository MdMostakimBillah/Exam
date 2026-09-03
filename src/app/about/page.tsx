"use client";
import Link from "next/link";
import { Building2, Users, Award, Globe, Shield, Heart } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#080808]">
      <header className="fixed top-0 w-full z-50 border-b border-white/[0.06] bg-[#080808]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-black font-bold text-sm">S</div>
            <span className="text-sm font-semibold text-zinc-100">ScholarX</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/about" className="text-sm text-zinc-300">About</Link>
            <Link href="/features" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Features</Link>
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
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-6">About ScholarX</h1>
          <p className="text-lg text-zinc-500 leading-relaxed mb-12">
            ScholarX is a comprehensive scholarship examination management platform designed to streamline the entire process — from student registration to certificate verification.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
            {[
              { icon: Globe, title: 'Multi-Institution Platform', desc: 'Supporting hundreds of institutions across Bangladesh with isolated, secure workspaces.' },
              { icon: Users, title: 'Student-Centric', desc: 'Built around the needs of students, making scholarship examinations accessible and transparent.' },
              { icon: Shield, title: 'Secure & Reliable', desc: 'Enterprise-grade security with certificate verification and audit logging.' },
              { icon: Award, title: 'Official Certificates', desc: 'Generate verifiable, official scholarship certificates with QR codes.' },
            ].map(item => (
              <div key={item.title} className="rounded-xl border border-white/[0.06] bg-[#111111] p-6">
                <item.icon className="h-6 w-6 text-zinc-400 mb-3" />
                <h3 className="text-sm font-semibold text-zinc-100 mb-2">{item.title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="prose prose-invert max-w-none">
            <h2 className="text-2xl font-bold text-white mb-4">Our Mission</h2>
            <p className="text-zinc-500 leading-relaxed mb-6">
              We believe every student deserves a fair and transparent scholarship examination process. ScholarX was created to eliminate the administrative burden on institutions while ensuring students can focus on what matters most — their education.
            </p>
            <h2 className="text-2xl font-bold text-white mb-4">Our Vision</h2>
            <p className="text-zinc-500 leading-relaxed">
              To become the leading platform for scholarship examination management across South Asia, enabling institutions to run examinations with confidence and students to achieve their academic dreams.
            </p>
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
