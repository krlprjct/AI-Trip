"use client";
import Link from "next/link";

export default function TgPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900 flex flex-col">
      <header className="border-b border-neutral-200">
        <div className="max-w-[1280px] mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            🗺️ AI-Trip
          </Link>
          <Link href="/" className="text-sm text-neutral-600 hover:text-neutral-900">← Главная</Link>
        </div>
      </header>
      <section className="flex-1 max-w-[1280px] mx-auto w-full px-6 py-20 grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 mb-6">
            Скоро в Telegram
          </span>
          <h1 className="text-5xl tracking-tight font-[550] leading-[1.05] mb-6">
            AI-Trip <span className="text-neutral-500">в кармане.</span>
          </h1>
          <p className="text-lg text-neutral-600 max-w-[40ch] mb-8">
            Запросите маршрут одним сообщением. Получите 3 варианта прямо в чате.
            Бот напишет и отправит план поездки в PDF.
          </p>
          <ul className="space-y-3 text-neutral-700 mb-10">
            <li className="flex items-center gap-3">✅ Одно сообщение — три маршрута</li>
            <li className="flex items-center gap-3">✅ Билеты Tutu, отели Островок</li>
            <li className="flex items-center gap-3">✅ Push-уведомления о падении цен</li>
            <li className="flex items-center gap-3">✅ Чат с поддержкой 24/7</li>
          </ul>
          <a
            href="https://t.me/aitrip_bot"
            target="_blank"
            rel="noopener"
            className="inline-flex h-[42px] items-center px-6 rounded-full bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800"
          >
            Открыть @aitrip_bot
          </a>
        </div>
        <div className="flex flex-col items-center gap-6">
          <div className="p-8 bg-white rounded-3xl ring-1 ring-neutral-950/10 shadow-xl">
            <img
              src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://t.me/aitrip_bot&margin=10"
              alt="QR Telegram"
              className="w-[280px] h-[280px]"
            />
          </div>
          <p className="text-sm text-neutral-500">Наведите камеру — откроется бот</p>
        </div>
      </section>
      <footer className="border-t border-neutral-200 py-8 text-center text-sm text-neutral-500">
        © 2026 AI-Trip · Российский ИИ-планировщик путешествий
      </footer>
    </main>
  );
}
