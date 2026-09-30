import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bangladesh Madrasah Association — Scholarship Examination Management Platform",
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
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var lang = localStorage.getItem('scholarx-lang') || 'en';
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.add('lang-' + lang);
                  document.body.classList.add('dark');
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
