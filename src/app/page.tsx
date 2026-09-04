"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { initializeDemoData } from "@/lib/storage/seed";
import { getCurrentUser } from "@/lib/auth/auth";
import { useLang } from "@/contexts/language-context";
import { useTheme } from "@/contexts/theme-context";
import { EducationIllustration } from "@/components/ui/education-illustration";
import { Building2, Users, FileText, Award, CreditCard, BarChart3, ArrowRight, BookOpen, ClipboardList, Sun, Moon, Globe, Check, Star } from "lucide-react";

function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.unobserve(el); } },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, className: `scroll-reveal ${visible ? "is-visible" : ""}` };
}

export default function HomePage() {
  const router = useRouter();
  const { t, lang, setLang } = useLang();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    initializeDemoData();
    const user = getCurrentUser();
    if (user) {
      if (user.role === "SUPER_ADMIN") router.push("/super-admin");
      else if (user.role === "INSTITUTION_ADMIN") router.push("/i");
    }
  }, [router]);

  const glassBg = isDark 
    ? "bg-white/5 backdrop-blur-xl border border-white/10" 
    : "bg-white/80 backdrop-blur-xl border border-zinc-200";
  const glassCard = isDark 
    ? "bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08]" 
    : "bg-white border border-zinc-200 shadow-sm shadow-zinc-200/50";
  const text = isDark ? "text-zinc-100" : "text-zinc-900";
  const textSec = isDark ? "text-zinc-400" : "text-zinc-500";
  const textNav = isDark ? "text-zinc-400 hover:text-zinc-200" : "text-zinc-500 hover:text-zinc-900";
  const border = isDark ? "border-white/[0.06]" : "border-zinc-200";
  const btnPrimary = isDark 
    ? "bg-white text-zinc-900 hover:bg-zinc-200 shadow-lg shadow-white/10" 
    : "bg-zinc-900 text-white hover:bg-zinc-800 shadow-lg shadow-black/10";
  const btnSecondary = isDark 
    ? "border border-white/10 text-zinc-300 hover:bg-white/5 hover:border-white/20" 
    : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100";
  const iconBtn = isDark ? "text-zinc-400 hover:text-zinc-200 hover:bg-white/5" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100";

  const features = [
    { icon: Building2, title: t("features.institution"), desc: t("features.institutionDesc") },
    { icon: Users, title: t("features.studentReg"), desc: t("features.studentRegDesc") },
    { icon: FileText, title: t("features.examMgmt"), desc: t("features.examMgmtDesc") },
    { icon: ClipboardList, title: t("features.admitCards"), desc: t("features.admitCardsDesc") },
    { icon: BookOpen, title: t("features.marksResults"), desc: t("features.marksResultsDesc") },
    { icon: Award, title: t("features.certificates"), desc: t("features.certificatesDesc") },
    { icon: CreditCard, title: t("features.payments"), desc: t("features.paymentsDesc") },
    { icon: BarChart3, title: t("features.reports"), desc: t("features.reportsDesc") },
  ];

  const steps = [t("workflow.step1"), t("workflow.step2"), t("workflow.step3"), t("workflow.step4"), t("workflow.step5"), t("workflow.step6")];

  const stats = [
    { label: "Institutions", value: "500+", icon: Building2 },
    { label: "Students", value: "50,000+", icon: Users },
    { label: "Exams", value: "1,200+", icon: FileText },
    { label: "Results", value: "98%", icon: Award },
  ];

  const testimonials = [
    { name: "Rafiq Islam", role: "Institution Admin", text: "ScholarX transformed how we manage examinations. The automation saved us countless hours.", avatar: "RI" },
    { name: "Fatema Begum", role: "Super Admin", text: "The bilingual support and certificate verification are outstanding. Highly recommended.", avatar: "FB" },
    { name: "Abdul Hasan", role: "Principal", text: "Our students love the easy registration process. Results are published instantly.", avatar: "AH" },
  ];

  const statsReveal = useScrollReveal(0.2);
  const featuresReveal = useScrollReveal(0.1);
  const platformTextReveal = useScrollReveal(0.2);
  const platformCardReveal = useScrollReveal(0.2);
  const workflowReveal = useScrollReveal(0.15);
  const testimonialsReveal = useScrollReveal(0.15);
  const ctaReveal = useScrollReveal(0.2);

  return (
    <div className={`${isDark ? "bg-[#0a0a0b]" : "bg-zinc-100/50"} min-h-screen`}>
      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fade-in {
          animation: fadeIn 1s ease-out forwards;
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animation-delay-100 { animation-delay: 0.1s; }
        .animation-delay-200 { animation-delay: 0.2s; }
        .animation-delay-300 { animation-delay: 0.3s; }
        .animation-delay-400 { animation-delay: 0.4s; }
        .animation-delay-500 { animation-delay: 0.5s; }

        .scroll-reveal {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .scroll-reveal.is-visible {
          opacity: 1;
          transform: translateY(0);
        }
        .scroll-reveal-left {
          opacity: 0;
          transform: translateX(-40px);
          transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .scroll-reveal-left.is-visible {
          opacity: 1;
          transform: translateX(0);
        }
        .scroll-reveal-right {
          opacity: 0;
          transform: translateX(40px);
          transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .scroll-reveal-right.is-visible {
          opacity: 1;
          transform: translateX(0);
        }
        .scroll-reveal-scale {
          opacity: 0;
          transform: scale(0.95);
          transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .scroll-reveal-scale.is-visible {
          opacity: 1;
          transform: scale(1);
        }
        .stagger-1 { transition-delay: 0.05s; }
        .stagger-2 { transition-delay: 0.1s; }
        .stagger-3 { transition-delay: 0.15s; }
        .stagger-4 { transition-delay: 0.2s; }
        .stagger-5 { transition-delay: 0.25s; }
        .stagger-6 { transition-delay: 0.3s; }
        .stagger-7 { transition-delay: 0.35s; }
        .stagger-8 { transition-delay: 0.4s; }
      `}</style>

      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 ${glassBg}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${isDark ? "bg-white text-zinc-900" : "bg-zinc-900 text-white"}`}>B</div>
            <span className={`text-sm font-semibold ${text}`}>{t("brand")}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className={`text-sm transition-colors ${textNav}`}>{t("nav.features")}</a>
            <a href="#platform" className={`text-sm transition-colors ${textNav}`}>{t("nav.platform")}</a>
            <a href="#workflow" className={`text-sm transition-colors ${textNav}`}>{t("nav.workflow")}</a>
            <Link href="/result" className={`text-sm transition-colors ${textNav}`}>{t("nav.results")}</Link>
            <Link href="/verify-certificate" className={`text-sm transition-colors ${textNav}`}>{t("nav.verify")}</Link>
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={() => setLang(lang === "en" ? "bn" : "en")} className={`p-2.5 rounded-xl transition-all ${iconBtn}`}>
              <Globe className="w-4 h-4" />
            </button>
            <button onClick={toggleTheme} className={`p-2.5 rounded-xl transition-all ${iconBtn}`}>
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link href="/login" className={`text-sm px-4 py-2 rounded-xl transition-all ${textNav}`}>{t("nav.signIn")}</Link>
            <Link href="/register" className={`text-sm px-5 py-2.5 rounded-xl font-medium transition-all ${btnPrimary}`}>{t("nav.registerInstitution")}</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center pt-32 pb-20 px-6 overflow-hidden">
        {/* Background gradient orbs */}
        <div className={`absolute top-1/4 left-0 w-[500px] h-[500px] rounded-full blur-[120px] ${isDark ? "bg-blue-500/10" : "bg-blue-500/5"}`} />
        <div className={`absolute bottom-1/4 right-0 w-[400px] h-[400px] rounded-full blur-[100px] ${isDark ? "bg-purple-500/10" : "bg-purple-500/5"}`} />
        
        <div className="max-w-7xl mx-auto w-full relative">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="space-y-8 animate-fade-in-up opacity-0">
              <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs ${glassCard}`}>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className={textSec}>Now accepting new institutions</span>
              </div>

              <h1 className={`text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] ${text}`}>
                {t("hero.title1")}{" "}
                <span className={textSec}>{t("hero.title2")}</span>
              </h1>

              <p className={`text-base sm:text-lg max-w-lg leading-relaxed ${textSec}`}>{t("hero.subtitle")}</p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <Link href="/register" className={`inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-medium transition-all hover:scale-105 ${btnPrimary}`}>
                  {t("hero.ctaRegister")} <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#platform" className={`inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-medium transition-all hover:scale-105 ${btnSecondary}`}>
                  {t("hero.ctaExplore")}
                </a>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <div className="flex -space-x-2">
                  {['RI', 'FB', 'AH', 'MK'].map((initials) => (
                    <div key={initials} className={`h-9 w-9 rounded-full flex items-center justify-center text-[10px] font-semibold border-2 ${isDark ? 'border-[#0a0a0b] bg-zinc-700' : 'border-white bg-zinc-800 text-white'}`}>
                      {initials}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map((star) => (
                      <Star key={star} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className={`text-xs ${textSec}`}>Trusted by 500+ institutions</p>
                </div>
              </div>
            </div>

            <div className="relative h-[400px] lg:h-[500px] animate-float">
              <EducationIllustration isDark={isDark} />
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <span className={`text-[10px] uppercase tracking-widest ${textSec}`}>Scroll</span>
          <div className={`w-6 h-10 rounded-full border flex justify-center pt-2 ${isDark ? 'border-white/20' : 'border-zinc-300'}`}>
            <div className={`w-1 h-2 rounded-full animate-bounce ${isDark ? 'bg-white/40' : 'bg-zinc-500'}`} />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className={`py-20 ${isDark ? "bg-white/5 border-y border-white/[0.06]" : "bg-white border-y border-zinc-200"}`}>
        <div className="max-w-7xl mx-auto px-6" ref={statsReveal.ref}>
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-8 ${statsReveal.className}`}>
            {stats.map((stat, i) => (
              <div key={stat.label} className={`text-center scroll-reveal-scale stagger-${i + 1}`}>
                <stat.icon className={`h-6 w-6 mx-auto mb-3 ${textSec}`} />
                <p className={`text-3xl sm:text-4xl font-bold ${text}`}>{stat.value}</p>
                <p className={`text-sm ${textSec}`}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 sm:py-32 px-6">
        <div className="max-w-7xl mx-auto" ref={featuresReveal.ref}>
          <div className={`text-center mb-16 scroll-reveal ${featuresReveal.className.replace("scroll-reveal", "")}`}>
            <span className={`inline-block text-xs font-medium uppercase tracking-widest mb-4 px-4 py-1.5 rounded-full ${isDark ? "bg-white/5 border border-white/10 text-zinc-400" : "bg-zinc-100 border border-zinc-200 text-zinc-500"}`}>
              Features
            </span>
            <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4 ${text}`}>{t("features.sectionTitle")}</h2>
            <p className={`text-base max-w-2xl mx-auto ${textSec}`}>{t("features.sectionSubtitle")}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <div
                key={f.title}
                className={`group rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 ${glassCard} scroll-reveal stagger-${i + 1}`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110 ${isDark ? "bg-white/10" : "bg-zinc-100 border border-zinc-200"}`}>
                  <f.icon className={`h-5 w-5 ${textSec}`} />
                </div>
                <h3 className={`text-sm font-semibold mb-2 ${text}`}>{f.title}</h3>
                <p className={`text-sm leading-relaxed ${textSec}`}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform */}
      <section id="platform" className="py-24 sm:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div ref={platformTextReveal.ref} className={`scroll-reveal-left ${platformTextReveal.className.replace("scroll-reveal", "")}`}>
              <span className={`inline-block text-xs font-medium uppercase tracking-widest mb-4 px-4 py-1.5 rounded-full ${isDark ? "bg-white/5 border border-white/10 text-zinc-400" : "bg-zinc-100 border border-zinc-200 text-zinc-500"}`}>
                Platform
              </span>
              <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6 ${text}`}>
                Complete scholarship<br />management solution
              </h2>
              <p className={`text-base leading-relaxed mb-8 ${textSec}`}>
                From registration to certificate verification, ScholarX provides end-to-end management for scholarship examinations.
              </p>
              <div className="space-y-4">
                {[
                  "Automated registration and eligibility checks",
                  "Real-time exam scheduling and updates",
                  "Secure certificate generation and verification",
                  "Comprehensive analytics and reporting"
                ].map((item, i) => (
                  <div key={item} className={`flex items-center gap-3 scroll-reveal stagger-${i + 1}`}>
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${isDark ? "bg-emerald-500/20" : "bg-emerald-50 border border-emerald-200"}`}>
                      <Check className={`h-3.5 w-3.5 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
                    </div>
                    <span className={`text-sm ${text}`}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div ref={platformCardReveal.ref} className={`scroll-reveal-right ${platformCardReveal.className.replace("scroll-reveal", "")}`}>
              <div className={`rounded-2xl overflow-hidden ${glassCard}`}>
                <div className={`h-12 flex items-center gap-2 px-5 ${isDark ? "bg-white/5" : "bg-zinc-100"}`}>
                  <div className="h-3 w-3 rounded-full bg-red-500/80" />
                  <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                  <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "Institutions", value: "10" },
                      { label: "Students", value: "2,240" },
                      { label: "Exams", value: "3" },
                    ].map((item) => (
                      <div key={item.label} className={`rounded-xl p-4 ${isDark ? "bg-white/[0.03]" : "bg-zinc-50"}`}>
                        <p className={`text-xs ${textSec} mb-1`}>{item.label}</p>
                        <p className={`text-xl font-semibold ${text}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className={`rounded-xl p-4 ${isDark ? "bg-white/[0.03]" : "bg-zinc-50"}`}>
                    <p className={`text-xs ${textSec} mb-3`}>Registration Trends</p>
                    <div className="flex items-end gap-2 h-16">
                      {[40, 55, 70, 85, 60, 75, 90, 65, 80, 95, 70, 88].map((h, i) => (
                        <div
                          key={i}
                          className={`flex-1 rounded-t-sm ${isDark ? "bg-white/20" : "bg-zinc-300"}`}
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section id="workflow" className="py-24 sm:py-32 px-6">
        <div className="max-w-7xl mx-auto" ref={workflowReveal.ref}>
          <div className={`text-center mb-16 scroll-reveal ${workflowReveal.className.replace("scroll-reveal", "")}`}>
            <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4 ${text}`}>{t("workflow.title")}</h2>
            <p className={`text-base max-w-xl mx-auto ${textSec}`}>Simple six-step process to get your institution up and running</p>
          </div>

          <div className="relative">
            <div className={`absolute top-8 left-0 right-0 h-px ${isDark ? "bg-white/10" : "bg-zinc-300"} hidden lg:block`} />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8">
              {steps.map((step, i) => (
                <div key={step} className={`relative text-center scroll-reveal stagger-${i + 1}`}>
                  <div className={`relative w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center backdrop-blur-xl ${glassCard} hover:scale-110 transition-transform`}>
                    <span className={`text-lg font-semibold ${text}`}>{i + 1}</span>
                  </div>
                  <p className={`text-sm leading-snug ${textSec}`}>{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 sm:py-32 px-6">
        <div className="max-w-7xl mx-auto" ref={testimonialsReveal.ref}>
          <div className={`text-center mb-16 scroll-reveal ${testimonialsReveal.className.replace("scroll-reveal", "")}`}>
            <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4 ${text}`}>Loved by administrators</h2>
            <p className={`text-base max-w-xl mx-auto ${textSec}`}>See what institutions are saying about ScholarX</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, i) => (
              <div key={testimonial.name} className={`rounded-2xl p-6 ${glassCard} scroll-reveal stagger-${i + 1}`}>
                <div className="flex items-center gap-1 mb-4">
                  {[1,2,3,4,5].map((star) => (
                    <Star key={star} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className={`text-sm leading-relaxed mb-6 ${text}`}>「{testimonial.text}」</p>
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-semibold ${isDark ? "bg-white/10 text-zinc-300" : "bg-zinc-900 text-white"}`}>
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${text}`}>{testimonial.name}</p>
                    <p className={`text-xs ${textSec}`}>{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 sm:py-32 px-6">
        <div className="max-w-7xl mx-auto" ref={ctaReveal.ref}>
          <div className={`rounded-3xl p-12 sm:p-16 text-center ${glassCard} relative overflow-hidden scroll-reveal-scale ${ctaReveal.className.replace("scroll-reveal", "")}`}>
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full blur-[100px] ${isDark ? "bg-blue-500/10" : "bg-blue-500/5"}`} />
            <div className={`absolute bottom-0 right-0 w-[200px] h-[200px] rounded-full blur-[80px] ${isDark ? "bg-purple-500/10" : "bg-purple-500/5"}`} />
            <div className="relative z-10">
              <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6 ${text}`}>{t("cta.title")}</h2>
              <p className={`text-base mb-10 max-w-md mx-auto ${textSec}`}>{t("cta.subtitle")}</p>
              <Link href="/register" className={`inline-flex items-center gap-2 px-10 py-4 rounded-2xl text-sm font-medium transition-all hover:scale-105 ${btnPrimary}`}>
                {t("cta.button")} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`py-16 px-6 ${isDark ? "bg-white/5 border-t border-white/[0.06]" : "bg-white border-t border-zinc-200"}`}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${isDark ? "bg-white text-zinc-900" : "bg-zinc-900 text-white"}`}>B</div>
                <span className={`text-sm font-semibold ${text}`}>{t("brand")}</span>
              </div>
              <p className={`text-xs leading-relaxed ${textSec}`}>{t("footer.tagline")}</p>
            </div>
            <div>
              <h4 className={`text-xs font-semibold uppercase tracking-wider mb-4 ${textSec}`}>{t("footer.product")}</h4>
              <ul className="space-y-2.5">
                <li><a href="#features" className={`text-xs transition-colors ${textNav}`}>Features</a></li>
                <li><a href="#platform" className={`text-xs transition-colors ${textNav}`}>Platform</a></li>
                <li><Link href="/pricing" className={`text-xs transition-colors ${textNav}`}>Pricing</Link></li>
              </ul>
            </div>
            <div>
              <h4 className={`text-xs font-semibold uppercase tracking-wider mb-4 ${textSec}`}>{t("footer.resources")}</h4>
              <ul className="space-y-2.5">
                <li><a href="#" className={`text-xs transition-colors ${textNav}`}>Documentation</a></li>
                <li><a href="#" className={`text-xs transition-colors ${textNav}`}>Guides</a></li>
                <li><a href="#" className={`text-xs transition-colors ${textNav}`}>Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className={`text-xs font-semibold uppercase tracking-wider mb-4 ${textSec}`}>{t("footer.company")}</h4>
              <ul className="space-y-2.5">
                <li><Link href="/about" className={`text-xs transition-colors ${textNav}`}>About</Link></li>
                <li><Link href="/contact" className={`text-xs transition-colors ${textNav}`}>Contact</Link></li>
                <li><a href="#" className={`text-xs transition-colors ${textNav}`}>Privacy</a></li>
              </ul>
            </div>
          </div>
          <div className={`pt-8 border-t text-center ${border}`}>
            <p className={`text-xs ${textSec}`}>© 2026 {t("brand")}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
