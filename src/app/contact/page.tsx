"use client";
import Link from "next/link";
import { useState } from "react";
import { Mail, Phone, MapPin, Send } from "lucide-react";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

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
            <Link href="/features" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Features</Link>
            <Link href="/pricing" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Pricing</Link>
            <Link href="/contact" className="text-sm text-zinc-300">Contact</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors px-3 py-1.5">Sign in</Link>
            <Link href="/register" className="text-sm bg-white text-black hover:bg-white/90 px-4 py-1.5 rounded-md font-medium transition-colors">Register</Link>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-6">Get in Touch</h1>
          <p className="text-lg text-zinc-500 mb-12 max-w-xl">
            Have questions? We&apos;d love to hear from you. Send us a message and we&apos;ll respond as soon as possible.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-6">
              {[
                { icon: Mail, label: 'Email', value: 'support@scholarx.com' },
                { icon: Phone, label: 'Phone', value: '+880-2-XXXXXXXX' },
                { icon: MapPin, label: 'Address', value: 'Dhaka, Bangladesh' },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-3">
                  <div className="rounded-lg bg-zinc-800/50 p-2"><item.icon className="h-4 w-4 text-zinc-400" /></div>
                  <div>
                    <p className="text-xs text-zinc-600 mb-0.5">{item.label}</p>
                    <p className="text-sm text-zinc-300">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="md:col-span-2">
              {submitted ? (
                <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-8 text-center">
                  <div className="rounded-full bg-emerald-500/10 p-3 w-fit mx-auto mb-4">
                    <Send className="h-6 w-6 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-100 mb-2">Message Sent</h3>
                  <p className="text-sm text-zinc-500">Thank you for reaching out. We&apos;ll get back to you within 24 hours.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="rounded-xl border border-white/[0.06] bg-[#111111] p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Name</label>
                      <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="h-9 w-full rounded-md border border-white/[0.06] bg-[#0D0D0D] px-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-zinc-500" placeholder="Your name" />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Email</label>
                      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="h-9 w-full rounded-md border border-white/[0.06] bg-[#0D0D0D] px-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-zinc-500" placeholder="your@email.com" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Subject</label>
                    <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required className="h-9 w-full rounded-md border border-white/[0.06] bg-[#0D0D0D] px-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-zinc-500" placeholder="How can we help?" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Message</label>
                    <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required rows={5} className="w-full rounded-md border border-white/[0.06] bg-[#0D0D0D] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-zinc-500 resize-none" placeholder="Tell us more..." />
                  </div>
                  <button type="submit" className="inline-flex items-center gap-2 bg-white text-black hover:bg-white/90 px-5 py-2.5 rounded-md text-sm font-medium transition-colors">
                    <Send className="h-4 w-4" /> Send Message
                  </button>
                </form>
              )}
            </div>
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
