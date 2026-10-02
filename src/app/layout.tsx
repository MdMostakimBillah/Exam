import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  // Short: this is also what the installed PWA's title bar shows — the
  // descriptor belongs in `description`, not the window chrome.
  title: "Bangladesh Madrasah Association",
  description: "A complete platform for institutions to manage scholarship examinations, student registrations, results, and certificates.",
  applicationName: "Madrasah Exam",
  // Lets iOS "Add to Home Screen" launch the app standalone (no browser chrome).
  appleWebApp: {
    capable: true,
    title: "Madrasah Exam",
    statusBarStyle: "black",
  },
};

/** themeColor lives on `viewport` (metadata.themeColor is deprecated since 14).
 *  Kept in sync with the user's light/dark toggle by <PwaInstaller>. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#090909",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `dark` matches ThemeProvider's first (SSR) render, so there is no
    // hydration mismatch; the script below swaps it for a stored preference
    // before first paint, and ThemeProvider confirms it in a layout effect.
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Mirror getInitialTheme(): scan the scholarx-theme-* keys so
                  // a light-mode user never sees a dark flash (this used to add
                  // 'dark' unconditionally).
                  var theme = 'dark';
                  var keys = Object.keys(localStorage);
                  for (var i = 0; i < keys.length; i++) {
                    if (keys[i].indexOf('scholarx-theme-') === 0) {
                      var v = localStorage.getItem(keys[i]);
                      if (v === 'light' || v === 'dark') { theme = v; break; }
                    }
                  }
                  var root = document.documentElement;
                  var drop = theme === 'dark' ? 'light' : 'dark';
                  root.classList.remove(drop);
                  document.body.classList.remove(drop);
                  root.classList.add(theme);
                  document.body.classList.add(theme);
                  root.style.colorScheme = theme;
                  root.classList.add('lang-' + (localStorage.getItem('scholarx-lang') || 'en'));
                } catch (e) {}
              })();
            `,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
