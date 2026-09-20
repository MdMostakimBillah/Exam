import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bangladesh Madrasah Association — Scholarship Examination Management Platform",
  description: "A complete platform for institutions to manage scholarship examinations, student registrations, results, and certificates.",
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
