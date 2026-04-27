import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI-Trip — Маршруты по России от ИИ",
  description: "Персональный маршрут путешествия от искусственного интеллекта за 30 секунд",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}
