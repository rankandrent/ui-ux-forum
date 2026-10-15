import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import { Header } from "@/components/Header";
import { AGENCY_URL, SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "https://forum.ui-ux.agency"),
  title: { default: `${SITE_NAME} — ${SITE_TAGLINE}`, template: `%s — ${SITE_NAME}` },
  description:
    "A Q&A community for UI/UX design questions: UX research, UI design, SaaS and AI products, design costs and hiring designers.",
  openGraph: { siteName: SITE_NAME, type: "website", locale: "en_US" },
  twitter: { card: "summary" },
};

export const viewport: Viewport = { themeColor: "#020816" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-US" className={jakarta.variable}>
      <body>
        <Header />
        <main className="container page">{children}</main>
        <footer className="site-footer">
          <div className="container">
            <span>
              © {new Date().getFullYear()} <a href={AGENCY_URL}>ui-ux.agency</a> — a UI/UX agency for AI, SaaS and
              startups, by tkxel.
            </span>
            <nav style={{ display: "flex", gap: 16 }} aria-label="Footer">
              <Link href="/tags/">Tags</Link>
              <a href={`${AGENCY_URL}/`}>Agency</a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
