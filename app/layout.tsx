import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Academy Master — Deep Learning for Any Topic",
  description: "Master any academic topic with deep concept maps, comprehensive works breakdowns, and NotebookLM integration.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        {children}
      </body>
    </html>
  );
}
