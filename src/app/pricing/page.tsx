"use client";
import Link from "next/link";
import { Check } from "lucide-react";

export default function PricingPage() {
  const plans = [
    {
      name: 'Starter',
      price: '2,500',
      period: '/year',
      desc: 'For small institutions getting started.',
      features: ['Up to 200 students', '1 exam per year', 'Basic result processing', 'Email support', 'Standard certificates'],
      cta: 'Get Started',
      popular: false,
    },
    {
      name: 'Professional',
      price: '7,500',
      period: '/year',
      desc: 'For growing institutions.',
      features: ['Up to 1,000 students', 'Unlimited exams', 'Advanced analytics', 'Priority support', 'Custom certificates', 'Bulk operations', 'Payment tracking'],
      cta: 'Start Free Trial',
      popular: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      desc: 'For large organizations.',
      features: ['Unlimited students', 'Unlimited exams', 'Custom branding', 'Dedicated support', 'API access', 'White-label option', 'Custom integrations', 'SLA guarantee'],
      cta: 'Contact Sales',
      popular: false,
    },
  ];

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
            <Link href="/pricing" className="text-sm text-zinc-300">Pricing</Link>
            <Link href="/contact" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Contact</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors px-3 py-1.5">Sign in</Link>
            <Link href="/register" className="text-sm bg-white text-black hover:bg-white/90 px-4 py-1.5 rounded-md font-medium transition-colors">Register</Link>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">Simple, Transparent Pricing</h1>
            <p className="text-lg text-zinc-500 max-w-lg mx-auto">Choose the plan that fits your institution. All plans include core features.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map(plan => (
              <div key={plan.name} className={`rounded-xl border p-6 ${plan.popular ? 'border-white/20 bg-[#151515]' : 'border-white/[0.06] bg-[#111111]'}`}>
                {plan.popular && <span className="text-[10px] uppercase tracking-wider text-zinc-400 bg-white/10 px-2 py-0.5 rounded-full">Most Popular</span>}
                <h3 className="text-lg font-semibold text-zinc-100 mt-2">{plan.name}</h3>
                <p className="text-xs text-zinc-500 mb-4">{plan.desc}</p>
                <div className="mb-6">
                  {plan.price !== 'Custom' && <span className="text-xs text-zinc-500">৳</span>}
                  <span className="text-3xl font-bold text-zinc-100">{plan.price}</span>
                  {plan.period && <span className="text-sm text-zinc-500">{plan.period}</span>}
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-zinc-400">
                      <Check className="h-4 w-4 text-zinc-600 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className={`block text-center py-2.5 rounded-md text-sm font-medium transition-colors ${plan.popular ? 'bg-white text-black hover:bg-white/90' : 'border border-white/[0.08] text-zinc-300 hover:bg-white/[0.03]'}`}>
                  {plan.cta}
                </Link>
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
