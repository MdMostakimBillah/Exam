"use client";
import { useEffect } from "react";

/**
 * PWA wiring for the app shell (root providers).
 *
 * 1) Registers public/sw.js.
 *    - production  -> /sw.js           (full caching rules)
 *    - `next dev`  -> /sw.js?dev=1     (service worker installs but its fetch
 *      listener is a no-op, so HMR/rebuilds are never served from a stale
 *      cache — see public/sw.js)
 *    `updateViaCache: "none"` forces the browser to revalidate sw.js itself
 *    so a deployed update is picked up on the next load.
 *
 * 2) Keeps <meta name="theme-color"> in sync with the light/dark class on
 *    <html> so the standalone PWA's status bar / window chrome matches the
 *    theme the user chose (Next renders the meta from the `viewport` export;
 *    we only rewrite its attribute — React never re-writes it because the
 *    static export value never changes, the same pattern SiteFavicon uses).
 */
export function PwaInstaller() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const src =
      process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?dev=1";
    navigator.serviceWorker
      .register(src, { updateViaCache: "none" })
      .catch(() => {
        /* registration failure must never break the page */
      });
  }, []);

  useEffect(() => {
    const apply = () => {
      const light =
        typeof document !== "undefined" &&
        document.documentElement.classList.contains("light");
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", light ? "#f4f4f5" : "#090909");
    };
    apply();
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return null;
}
