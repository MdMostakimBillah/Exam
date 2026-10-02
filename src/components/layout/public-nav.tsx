"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Globe, Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { useBranding, BRANDING_DEFAULTS } from "@/lib/storage/branding";

/** A row of the sub-nav panel: title + one-line description, no icons. */
interface MoreItem {
  href: string;
  title: string;
  desc: string;
}

/**
 * The landing page's floating glass pill, shared by every public lookup page
 * (apply / result / marksheet / verify-certificate) so the whole site talks
 * with one voice: a small centred bar whose edge is defined purely by a
 * translucent gradient body, heavy backdrop blur + saturation boost and a soft
 * drop shadow — no border, no ring — so it reads as a slab of frosted glass
 * floating over whatever page sits underneath.
 *
 * Sub-navigation (the "More" panel) follows the same recipe one level down:
 * the same glass, `rounded-md`, two columns of title + description.
 *
 * The bar is `fixed`, so it renders its own top spacer — drop it in where the
 * old sticky `<header>` was and nothing below it re-flows.
 */
export function PublicNav() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { t, lang, setLang } = useLang();
  const isDark = theme === "dark";

  const { data: brandData } = useBranding();
  const b = { ...BRANDING_DEFAULTS, ...(brandData ?? {}) };
  const brandName = (lang === "bn" ? b.brandNameBn : b.brandName) || t("brand");
  const brandLetter = brandName.trim().charAt(0).toUpperCase() || "B";

  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const shellRef = useRef<HTMLElement>(null);

  // Same glass recipe as the landing pill.
  const pillShell = isDark
    ? "bg-gradient-to-b from-white/[0.13] via-white/[0.09] to-white/[0.06] backdrop-blur-2xl backdrop-saturate-150 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]"
    : "bg-gradient-to-b from-white/90 via-white/80 to-white/70 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_20px_50px_-22px_rgba(0,0,0,0.45)]";
  const textNav = isDark ? "text-zinc-400 hover:text-zinc-200" : "text-zinc-500 hover:text-zinc-900";
  const iconBtn = isDark
    ? "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
    : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100";
  const mobileLink = isDark
    ? "text-zinc-300 hover:text-white hover:bg-white/[0.06]"
    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-900/[0.04]";
  const btnPrimary = `bg-brand-accent text-brand-accent-fg hover:opacity-90 ${
    isDark ? "shadow-lg shadow-white/10" : "shadow-lg shadow-black/10"
  }`;
  const btnSecondary = isDark
    ? "border border-white/10 text-zinc-300 hover:bg-white/5 hover:border-white/20"
    : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100";

  /** Top-level links — the four public destinations, the current one marked. */
  const links: { href: string; label: string }[] = [
    { href: "/apply", label: t("nav.apply") },
    { href: "/result", label: t("nav.results") },
    { href: "/marksheet", label: t("nav.marksheet") },
  ];

  /** The sub-nav panel — richer items, two columns like the reference. */
  const moreItems: MoreItem[] = [
    {
      href: "/verify-certificate",
      title: t("nav.verifyCertificate"),
      desc: t("nav.verifyCertificateDesc"),
    },
    { href: "/status", title: t("nav.trackApplication"), desc: t("nav.trackDesc") },
    { href: "/help", title: t("nav.help"), desc: t("nav.helpDesc") },
    { href: "/contact", title: t("nav.contact"), desc: t("nav.contactDesc") },
  ];

  const linkCls = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm transition-colors ${
      active ? "font-medium text-brand-accent" : textNav
    }`;

  // A route change closes both panels — they belong to the page you left.
  useEffect(() => {
    setMoreOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  // No scrim (the panels are anchored to the pill): close on Escape and on
  // any click outside the header.
  useEffect(() => {
    if (!moreOpen && !mobileOpen) return;
    const close = () => {
      setMoreOpen(false);
      setMobileOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onClick = (e: MouseEvent) => {
      const shell = shellRef.current;
      if (shell && !shell.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [moreOpen, mobileOpen]);

  return (
    <>
      {/* Head-room for the fixed bar (replaces the old sticky header's box) */}
      <div aria-hidden className="h-[68px] sm:h-[76px]" />

      <header
        ref={shellRef}
        data-public-nav
        className="fixed top-3 sm:top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-24px)] sm:w-[calc(100%-48px)] max-w-6xl"
      >
        <div className={`flex items-center gap-2 rounded-md px-2 py-2 ${pillShell}`}>
          <Link href="/" className="flex items-center gap-2.5 pl-1.5 pr-1 shrink-0 min-w-0">
            {b.brandLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={b.brandLogo}
                alt={brandName}
                className={`w-9 h-9 shrink-0 rounded-full object-contain bg-white/90 ring-1 ${
                  isDark ? "ring-white/15" : "ring-zinc-200"
                }`}
              />
            ) : (
              <div className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center font-bold text-sm bg-brand-accent text-brand-accent-fg">
                {brandLetter}
              </div>
            )}
            <span
              className={`text-sm font-semibold truncate max-w-[34vw] sm:max-w-[240px] ${
                isDark ? "text-zinc-100" : "text-zinc-900"
              }`}
            >
              {brandName}
            </span>
          </Link>

          <nav className="hidden xl:flex items-center gap-1 mx-auto px-3">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={linkCls(pathname === link.href)}>
                {link.label}
              </Link>
            ))}

            {/* Sub-nav: one glass panel, two columns of title + description */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                aria-haspopup="true"
                className={`${linkCls(moreOpen)} inline-flex items-center gap-1`}
              >
                {t("nav.more")}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`}
                />
              </button>

              {moreOpen && (
                <div
                  className={`absolute right-0 top-full mt-2 w-[min(560px,calc(100vw-32px))] rounded-md p-3 animate-fadeInDown ${pillShell}`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                    {moreItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`rounded-md p-3 transition-colors ${
                          pathname === item.href
                            ? isDark
                              ? "bg-white/[0.07]"
                              : "bg-white/70"
                            : isDark
                              ? "hover:bg-white/[0.06]"
                              : "hover:bg-white/70"
                        }`}
                      >
                        <div
                          className={`text-sm font-semibold ${
                            isDark ? "text-zinc-100" : "text-zinc-900"
                          }`}
                        >
                          {item.title}
                        </div>
                        <div
                          className={`mt-0.5 text-xs leading-relaxed ${
                            isDark ? "text-zinc-400" : "text-zinc-500"
                          }`}
                        >
                          {item.desc}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </nav>

          <div className="flex items-center gap-1 sm:gap-1.5 ml-auto xl:ml-0 shrink-0">
            <button
              onClick={() => setLang(lang === "en" ? "bn" : "en")}
              className={`p-2 sm:p-2.5 rounded-md transition-all ${iconBtn}`}
              aria-label={lang === "bn" ? "Switch to English" : "বাংলায় দেখুন"}
            >
              <Globe className="w-4 h-4" />
            </button>
            <button
              onClick={toggleTheme}
              className={`p-2 sm:p-2.5 rounded-md transition-all ${iconBtn}`}
              aria-label={isDark ? "Light mode" : "Dark mode"}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link
              href="/login"
              className={`hidden lg:inline-flex text-sm px-4 py-2 rounded-md transition-all ${textNav}`}
            >
              {t("nav.signIn")}
            </Link>
            <Link
              href="/register"
              className={`hidden xl:inline-flex text-sm px-5 py-2.5 rounded-md font-medium transition-all ${btnPrimary}`}
            >
              {t("nav.registerInstitution")}
            </Link>
            <button
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              className={`xl:hidden p-2 sm:p-2.5 rounded-md transition-all ${
                mobileOpen ? (isDark ? "bg-white/10 text-white" : "bg-zinc-900 text-white") : iconBtn
              }`}
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Below xl the link row would crowd the bar — same glass, drops down */}
        {mobileOpen && (
          <div
            className={`xl:hidden mt-2 rounded-md p-3 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_20px_50px_-22px_rgba(0,0,0,0.45)] animate-fadeInDown ${
              isDark
                ? "bg-gradient-to-b from-white/[0.13] via-white/[0.09] to-white/[0.06]"
                : "bg-gradient-to-b from-white/90 via-white/80 to-white/70"
            }`}
          >
            <div className="flex flex-col">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-md px-4 py-3 text-sm font-medium transition-colors ${
                    pathname === link.href ? "text-brand-accent" : mobileLink
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {moreItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-md px-4 py-3 text-sm font-medium transition-colors ${
                    pathname === item.href ? "text-brand-accent" : mobileLink
                  }`}
                >
                  {item.title}
                </Link>
              ))}
            </div>
            <div className={`mt-2 pt-3 border-t flex flex-col gap-2 ${isDark ? "border-white/10" : "border-zinc-200"}`}>
              <Link
                href="/login"
                className={`text-center text-sm px-4 py-3 rounded-md font-medium transition-all ${btnSecondary}`}
              >
                {t("nav.signIn")}
              </Link>
              <Link
                href="/register"
                className={`text-center text-sm px-4 py-3 rounded-md font-medium transition-all ${btnPrimary}`}
              >
                {t("nav.registerInstitution")}
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
