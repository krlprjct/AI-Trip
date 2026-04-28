"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { TravelFormData, RouteResult, RouteVariant, TransportOption } from "@/lib/schema";
import { transportLink, stayLink } from "@/lib/deep-links";

// ─── constants ────────────────────────────────────────────────────────────────

const DISTANCE_OPTIONS = [
  { value: "local", label: "В своём регионе" },
  { value: "russia", label: "По России" },
  { value: "abroad", label: "За рубежом" },
];

const STYLE_OPTIONS = [
  { value: "active", label: "Активный" },
  { value: "relaxed", label: "Спокойный" },
  { value: "family", label: "Семейный" },
  { value: "romantic", label: "Романтический" },
];

const PRIORITY_OPTIONS = [
  { value: "money", label: "Сэкономить" },
  { value: "time", label: "Быстро добраться" },
  { value: "destination", label: "Конкретное место" },
];

const TIER_LABELS: Record<string, string> = {
  budget: "ЭКОНОМ",
  balanced: "СБАЛАНСИРОВАННЫЙ",
  comfort: "КОМФОРТ",
};

const TRANSPORT_ICONS: Record<string, string> = {
  plane: "✈️",
  train: "🚂",
  bus: "🚌",
  car: "🚗",
};

const TIER_ACTIVITIES: Record<string, string> = {
  budget: "базовые",
  balanced: "средние",
  comfort: "премиум",
};

const LOADER_MESSAGES = [
  "Анализируем ваши параметры...",
  "Подбираем направление...",
  "Считаем билеты и отели...",
  "Собираем 3 варианта маршрута...",
];

const defaultForm: TravelFormData = {
  budget: 30000,
  days: 5,
  startCity: "Москва",
  distancePreference: "russia",
  tripStyle: "relaxed",
  peopleCount: 2,
  constraints: "",
  priority: "money",
  dateFrom: "",
  dateTo: "",
};

const POPULAR_DESTINATIONS = [
  {
    name: "Суздаль",
    icon: "🏰",
    hint: "3 дня от 18 000 ₽",
    form: { budget: 18000, days: 3, distancePreference: "russia" as const, tripStyle: "relaxed" as const, priority: "money" as const },
  },
  {
    name: "Санкт-Петербург",
    icon: "🌉",
    hint: "4 дня от 35 000 ₽",
    form: { budget: 35000, days: 4, distancePreference: "russia" as const, tripStyle: "relaxed" as const, priority: "time" as const },
  },
  {
    name: "Казань",
    icon: "🕌",
    hint: "3 дня от 25 000 ₽",
    form: { budget: 25000, days: 3, distancePreference: "russia" as const, tripStyle: "relaxed" as const, priority: "destination" as const },
  },
  {
    name: "Сочи",
    icon: "🌴",
    hint: "5 дней от 45 000 ₽",
    form: { budget: 45000, days: 5, distancePreference: "russia" as const, tripStyle: "relaxed" as const, priority: "money" as const },
  },
  {
    name: "Калининград",
    icon: "🏛️",
    hint: "4 дня от 30 000 ₽",
    form: { budget: 30000, days: 4, distancePreference: "russia" as const, tripStyle: "relaxed" as const, priority: "money" as const },
  },
  {
    name: "Карелия",
    icon: "🌲",
    hint: "4 дня от 28 000 ₽",
    form: { budget: 28000, days: 4, distancePreference: "russia" as const, tripStyle: "active" as const, priority: "money" as const },
  },
];

// ─── sub-components ───────────────────────────────────────────────────────────

function RadioPill({
  name,
  value,
  checked,
  onChange,
  label,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label: string;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span
        className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm transition-all ${
          checked
            ? "bg-neutral-900 text-white font-medium"
            : "bg-white ring-1 ring-neutral-950/10 text-neutral-600 hover:ring-neutral-950/20"
        }`}
      >
        {label}
      </span>
    </label>
  );
}

function TransportCard({
  opt,
  destination,
  startCity,
  dateFrom,
}: {
  opt: TransportOption;
  destination: string;
  startCity: string;
  dateFrom?: string;
}) {
  const link = transportLink(opt.type, startCity, destination, dateFrom);
  return (
    <div className="bg-neutral-950/[0.025] ring-1 ring-neutral-950/5 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{TRANSPORT_ICONS[opt.type] ?? "🚀"}</span>
        <div>
          <p className="font-medium text-neutral-900 text-sm leading-tight">{opt.label}</p>
          <p className="text-xs text-neutral-500">{opt.duration}</p>
        </div>
      </div>
      <p className="text-xl font-[550] text-neutral-900 tracking-tight">
        {opt.price_per_person.toLocaleString("ru")} ₽
        <span className="text-xs font-normal text-neutral-500 ml-1">/ чел</span>
      </p>
      <div className="space-y-1">
        {opt.pros.map((p, i) => (
          <p key={i} className="text-xs text-emerald-700">+ {p}</p>
        ))}
        {opt.cons.map((c, i) => (
          <p key={i} className="text-xs text-neutral-400">− {c}</p>
        ))}
      </div>
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto inline-flex items-center justify-center px-4 py-1.5 rounded-full text-xs font-medium bg-white ring-1 ring-neutral-950/10 text-neutral-700 hover:ring-neutral-950/20 transition"
      >
        Купить →
      </a>
    </div>
  );
}

function VariantCard({
  variant,
  recommended,
  destination,
}: {
  variant: RouteVariant;
  recommended: boolean;
  destination: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const stayBookLink = stayLink(destination);

  return (
    <div
      className={`bg-neutral-950/[0.025] ring-1 rounded-2xl p-6 flex flex-col gap-4 relative ${
        recommended ? "ring-neutral-900" : "ring-neutral-950/5"
      }`}
    >
      {recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-neutral-900 text-white text-xs font-medium px-3 py-1 rounded-full">
            Рекомендуем
          </span>
        </div>
      )}

      <div>
        <p className="text-xs font-mono uppercase tracking-widest text-neutral-500 mb-1">
          {TIER_LABELS[variant.tier]}
        </p>
        <p className="text-2xl font-[550] tracking-tight text-neutral-900">
          {variant.total_cost.toLocaleString("ru")} ₽
        </p>
        <p className="text-sm text-neutral-500 mt-1">{variant.title}</p>
      </div>

      {/* Transport */}
      <div className="bg-white ring-1 ring-neutral-950/10 rounded-xl p-3 flex items-center gap-3">
        <span className="text-xl">{TRANSPORT_ICONS[variant.transport.type] ?? "🚀"}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-900 truncate">{variant.transport.label}</p>
          <p className="text-xs text-neutral-500">{variant.transport.duration}</p>
        </div>
        <p className="text-sm font-[550] text-neutral-900 shrink-0">
          {variant.transport.price_per_person.toLocaleString("ru")} ₽/чел
        </p>
      </div>

      {/* Stay */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-neutral-900">{variant.stay.name}</p>
          <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
            {variant.stay.type === "hotel" ? "отель" : variant.stay.type === "hostel" ? "хостел" : "апартаменты"}
          </span>
        </div>
        <p className="text-sm font-[550] text-neutral-900">
          {variant.stay.price_per_night.toLocaleString("ru")} ₽
          <span className="text-xs font-normal text-neutral-500 ml-1">/ ночь / чел</span>
        </p>
        <p className="text-xs text-neutral-500 italic">{variant.stay.why_chosen}</p>
        <a
          href={stayBookLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white ring-1 ring-neutral-950/10 text-neutral-700 hover:ring-neutral-950/20 transition"
        >
          Забронировать →
        </a>
      </div>

      {/* Cost breakdown */}
      <div className="space-y-1.5">
        {Object.entries(variant.cost_breakdown).map(([key, val]) => {
          const labels: Record<string, string> = {
            transport: "Транспорт",
            stay: "Проживание",
            food: "Питание",
            activities: "Активности",
            buffer: "Запас",
          };
          const pct = Math.round((val / (variant.total_cost || 1)) * 100);
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 w-24 shrink-0">{labels[key]}</span>
              <div className="flex-1 bg-neutral-200 rounded-full h-1">
                <div className="bg-neutral-900 h-1 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-neutral-600 w-20 text-right shrink-0">
                {val.toLocaleString("ru")} ₽
              </span>
            </div>
          );
        })}
      </div>

      {/* Day plan toggle */}
      <div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-sm text-neutral-600 hover:text-neutral-900 underline underline-offset-2 transition"
        >
          {expanded ? "Скрыть план по дням" : "Показать план по дням"}
        </button>
        {expanded && (
          <div className="mt-3 space-y-3">
            {variant.day_plan.map((d) => (
              <div key={d.day} className="bg-white ring-1 ring-neutral-950/10 rounded-xl p-3 space-y-1.5">
                <p className="text-xs font-mono uppercase tracking-wider text-neutral-500">
                  День {d.day}{d.date ? ` · ${d.date}` : ""}
                </p>
                <div className="flex gap-2">
                  <span className="text-xs text-neutral-400 w-12 shrink-0">Утро</span>
                  <p className="text-xs text-neutral-700">{d.morning}</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-xs text-neutral-400 w-12 shrink-0">День</span>
                  <p className="text-xs text-neutral-700">{d.afternoon}</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-xs text-neutral-400 w-12 shrink-0">Вечер</span>
                  <p className="text-xs text-neutral-700">{d.evening}</p>
                </div>
                <p className="text-xs text-neutral-500 pt-1 border-t border-neutral-100">
                  Расходы дня: {d.estimated_day_cost.toLocaleString("ru")} ₽
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Must do */}
      <div>
        <p className="text-xs font-mono uppercase tracking-wider text-neutral-500 mb-2">Must do</p>
        <ul className="space-y-1">
          {variant.must_do.map((item, i) => (
            <li key={i} className="flex gap-2 text-xs text-neutral-700">
              <span className="text-emerald-600 shrink-0">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function LoaderState() {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setMsgIndex((i) => (i < LOADER_MESSAGES.length - 1 ? i + 1 : i));
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-10 h-10 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
      <p className="text-sm text-neutral-600 transition-all">{LOADER_MESSAGES[msgIndex]}</p>
      <p className="text-xs text-neutral-400">Обычно 15–30 секунд</p>
    </div>
  );
}

// ─── tier emoji + bonus labels ────────────────────────────────────────────────

const TIER_EMOJI: Record<string, string> = {
  budget: "🥉",
  balanced: "🥈",
  comfort: "🥇",
};

const TIER_DISPLAY_LABELS: Record<string, string> = {
  budget: "Эконом",
  balanced: "Сбалансированный",
  comfort: "Комфорт",
};

const TIER_BONUS: Record<string, { emoji: string; label: string }> = {
  budget: { emoji: "💰", label: "Экономия" },
  balanced: { emoji: "⚖️", label: "Лучший баланс" },
  comfort: { emoji: "✨", label: "Премиум" },
};

// ─── Duolingo-style cards ─────────────────────────────────────────────────────

function DuolingoCards({
  variants,
  activeTier,
  onSelect,
}: {
  variants: RouteVariant[];
  activeTier: string;
  onSelect: (tier: "budget" | "balanced" | "comfort") => void;
}) {
  const tiers = ["budget", "balanced", "comfort"] as const;

  const handleSelect = (tier: "budget" | "balanced" | "comfort") => {
    onSelect(tier);
    setTimeout(() => {
      document.getElementById("variant-detail")?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  return (
    <div className="mb-10">
      <h2 className="text-3xl md:text-4xl tracking-tight font-[550] mb-2">
        Выбери свой маршрут
      </h2>
      <p className="text-neutral-600 mb-8">3 варианта собраны под ваш бюджет и стиль</p>

      <div className="grid md:grid-cols-3 gap-5 items-start">
        {tiers.map((tier) => {
          const v = variants.find((vv) => vv.tier === tier);
          if (!v) return null;

          const isBalanced = tier === "balanced";
          const isSelected = activeTier === tier;
          const avgDayCost =
            v.day_plan.length > 0
              ? Math.round(
                  v.day_plan.reduce((acc, d) => acc + d.estimated_day_cost, 0) / v.day_plan.length
                )
              : null;
          const bonus = TIER_BONUS[tier];

          return (
            <div
              key={tier}
              className={`relative bg-white ring-2 rounded-3xl p-6 flex flex-col gap-4 transition-transform ${
                isBalanced
                  ? "ring-emerald-500/40 md:scale-[1.02]"
                  : "ring-neutral-200"
              }`}
            >
              {/* Editor's choice badge */}
              {isBalanced && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1 rounded-full bg-amber-400 text-amber-950 text-xs font-bold tracking-wide shadow-md">
                  ★ ВЫБОР РЕДАКЦИИ
                </div>
              )}

              {/* Tier header */}
              <div className="flex flex-col items-center text-center gap-1 pt-2">
                <span className="text-4xl">{TIER_EMOJI[tier]}</span>
                <p className="font-bold text-lg text-neutral-900 leading-tight">
                  {TIER_DISPLAY_LABELS[tier]}
                </p>
              </div>

              {/* Price */}
              <div className="text-center">
                <p className="text-4xl font-[700] tracking-tight text-neutral-900">
                  {v.total_cost.toLocaleString("ru")} ₽
                </p>
                <p className="text-xs text-neutral-500 mt-0.5">за всю поездку</p>
              </div>

              {/* Achievement chips */}
              <div className="flex flex-col gap-2">
                {/* Transport chip */}
                <div className="flex items-center gap-2 bg-neutral-100 rounded-full px-3 py-1.5 text-xs text-neutral-700">
                  <span>{TRANSPORT_ICONS[v.transport.type] ?? "🚀"}</span>
                  <span className="font-medium">
                    {v.transport.price_per_person.toLocaleString("ru")} ₽
                  </span>
                  <span className="text-neutral-500 truncate">транспорт</span>
                </div>

                {/* Stay chip */}
                <div className="flex items-center gap-2 bg-neutral-100 rounded-full px-3 py-1.5 text-xs text-neutral-700">
                  <span>🏨</span>
                  <span className="font-medium truncate max-w-[200px]">{v.stay.name}</span>
                </div>

                {/* Day cost chip */}
                {avgDayCost !== null && (
                  <div className="flex items-center gap-2 bg-neutral-100 rounded-full px-3 py-1.5 text-xs text-neutral-700">
                    <span>📅</span>
                    <span className="font-medium">
                      ~{avgDayCost.toLocaleString("ru")} ₽/день
                    </span>
                  </div>
                )}

                {/* Bonus chip */}
                <div className="flex items-center gap-2 bg-emerald-50 rounded-full px-3 py-1.5 text-xs text-emerald-700 font-medium">
                  <span>{bonus.emoji}</span>
                  <span>{bonus.label}</span>
                </div>
              </div>

              {/* Select button */}
              <button
                onClick={() => handleSelect(tier)}
                className={`w-full h-14 rounded-2xl font-bold text-base transition-all ${
                  isSelected
                    ? "bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500 shadow-none"
                    : "bg-emerald-500 text-white shadow-[0_4px_0_0_rgb(5,122,85)] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_rgb(5,122,85)] active:translate-y-[4px] active:shadow-none"
                }`}
              >
                {isSelected ? "Выбрано ✓" : "Выбрать"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [form, setForm] = useState<TravelFormData>(defaultForm);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTier, setActiveTier] = useState<"budget" | "balanced" | "comfort">("balanced");
  const [toast, setToast] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // URL params auto-fill
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const budget = sp.get("budget");
    if (!budget) return;
    const parsed: Partial<TravelFormData> = {};
    if (sp.get("budget")) parsed.budget = Number(sp.get("budget"));
    if (sp.get("days")) parsed.days = Number(sp.get("days"));
    if (sp.get("distancePreference")) parsed.distancePreference = sp.get("distancePreference") as TravelFormData["distancePreference"];
    if (sp.get("tripStyle")) parsed.tripStyle = sp.get("tripStyle") as TravelFormData["tripStyle"];
    if (sp.get("priority")) parsed.priority = sp.get("priority") as TravelFormData["priority"];
    if (sp.get("constraints")) parsed.constraints = sp.get("constraints") as string;
    if (sp.get("startCity")) parsed.startCity = sp.get("startCity") as string;
    setForm((prev) => ({ ...prev, ...parsed }));
    // auto-submit
    setTimeout(() => {
      formRef.current?.requestSubmit();
    }, 200);
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  const runSubmit = async (overrideForm?: Partial<TravelFormData>) => {
    const submitForm = overrideForm ? { ...form, ...overrideForm } : form;
    setLoading(true);
    setError(null);
    setResult(null);
    setActiveTier("balanced");

    try {
      const res = await fetch("/api/generate-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitForm),
        signal: AbortSignal.timeout(65000),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка сервера");
      setResult(data);

      setTimeout(() => {
        document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.name === "TimeoutError" ? "Превышено время ожидания. Попробуйте ещё раз." : err.message);
      } else {
        setError("Неизвестная ошибка");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runSubmit();
  };

  const handleDestinationClick = (dest: (typeof POPULAR_DESTINATIONS)[0]) => {
    const merged = {
      ...form,
      ...dest.form,
      constraints: `Хочу поехать в ${dest.name}`,
    };
    setForm(merged);
    runSubmit(merged);
    document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleShare = () => {
    const params = new URLSearchParams({
      budget: String(form.budget),
      days: String(form.days),
      startCity: form.startCity,
      distancePreference: form.distancePreference,
      tripStyle: form.tripStyle,
      priority: form.priority,
      constraints: form.constraints ?? "",
    });
    navigator.clipboard.writeText(window.location.origin + "/?" + params.toString());
    setToast(true);
    setTimeout(() => setToast(false), 2000);
  };

  const activeVariant = result?.variants.find((v) => v.tier === activeTier);

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* ── TOAST ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white text-sm px-5 py-2.5 rounded-full shadow-lg">
          Ссылка скопирована
        </div>
      )}

      {/* ── NAV ── */}
      <nav className="border-b border-neutral-200 sticky top-0 z-50 bg-white/95 backdrop-blur">
        <div className="max-w-[1280px] mx-auto px-6 h-14 flex items-center justify-between border-x border-neutral-200">
          <div className="flex items-center gap-8">
            <a href="#" className="flex items-center gap-2 font-[550] text-neutral-900">
              <span>🗺️</span> AI-Trip
            </a>
            <div className="hidden md:flex items-center gap-6">
              {["Главная", "Как работает", "Тарифы"].map((l) => (
                <a key={l} href={`#${l}`} className="text-sm text-neutral-500 hover:text-neutral-900 transition">
                  {l}
                </a>
              ))}
              <Link href="/tg" className="text-sm text-neutral-500 hover:text-neutral-900 transition">
                Бот
              </Link>
            </div>
          </div>
          <button className="hidden md:inline-flex items-center px-4 py-1.5 rounded-full text-sm bg-white ring-1 ring-neutral-950/10 shadow-sm text-neutral-700 hover:ring-neutral-950/20 transition">
            Войти
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="border-x border-neutral-200 max-w-[1280px] mx-auto">
        <div className="px-6 py-20 md:py-28">
          <div className="max-w-[680px]">
            <h1 className="text-5xl md:text-6xl font-[550] tracking-tight leading-[1.05] text-neutral-900">
              Маршрут по России.<br />
              <span className="text-neutral-400">3 варианта за 30 секунд.</span>
            </h1>
            <p className="text-base text-neutral-600 max-w-[48ch] mt-6">
              Задайте бюджет, стиль и количество дней — ИИ соберёт бюджетный, сбалансированный и комфортный вариант с конкретными отелями, билетами и планом по дням.
            </p>
            <div className="flex gap-3 flex-wrap mt-6">
              <a
                href="#form"
                className="inline-flex items-center px-5 py-2 rounded-full bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 transition"
              >
                Спланировать поездку
              </a>
              <a
                href="#how"
                className="inline-flex items-center px-5 py-2 rounded-full bg-white ring-1 ring-neutral-950/10 shadow-sm text-neutral-700 text-sm hover:ring-neutral-950/20 transition"
              >
                Как это работает
              </a>
            </div>
          </div>
          <div className="mt-12 lg:mt-16 -mx-6 sm:mx-0">
            <img
              src="/hero.png"
              alt="Путешествие на поезде через Россию — вид из окна на старинный город"
              className="w-full max-h-[520px] object-cover rounded-3xl ring-1 ring-neutral-950/10 shadow-xl shadow-neutral-950/5"
              loading="eager"
            />
          </div>
        </div>
      </section>

      {/* ── RU advantages ── */}
      <div className="canvas-grid-line" />
      <section className="border-x border-neutral-200 max-w-[1280px] mx-auto">
        <div className="px-6 py-8 grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: "🏨", text: "Отели через Островок" },
            { icon: "🎫", text: "Билеты Tutu / Aviasales" },
            { icon: "💳", text: "Оплата в ₽" },
            { icon: "🌍", text: "Более 100 городов РФ" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-3">
              <span className="text-xl">{item.icon}</span>
              <span className="text-sm text-neutral-700">{item.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── POPULAR DESTINATIONS ── */}
      <div className="canvas-grid-line" />
      <section className="border-x border-neutral-200 max-w-[1280px] mx-auto">
        <div className="px-6 py-14">
          <h2 className="text-2xl md:text-3xl font-[550] tracking-tight mb-2">
            Куда поехать?
          </h2>
          <p className="text-sm text-neutral-500 mb-8">
            Кликни на город — соберём маршрут за 30 секунд
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {POPULAR_DESTINATIONS.map((dest) => (
              <button
                key={dest.name}
                onClick={() => handleDestinationClick(dest)}
                className="bg-white ring-1 ring-neutral-950/10 rounded-2xl p-6 hover:shadow-lg cursor-pointer text-left transition-all hover:ring-neutral-950/20 group"
              >
                <div className="text-3xl mb-3">{dest.icon}</div>
                <p className="font-medium text-neutral-900 group-hover:text-neutral-700">{dest.name}</p>
                <p className="text-sm text-neutral-500 mt-1">{dest.hint}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── FORM ── */}
      <div className="canvas-grid-line" />
      <section id="form" className="border-x border-neutral-200 max-w-[1280px] mx-auto">
        <div className="px-6 py-16">
          <h2 className="text-3xl md:text-4xl font-[550] tracking-tight mb-10">
            <span className="text-neutral-900">Расскажите о поездке.</span>{" "}
            <span className="text-neutral-400">Мы соберём 3 готовых варианта.</span>
          </h2>

          <form ref={formRef} onSubmit={handleSubmit} className="max-w-2xl space-y-6">
            {/* budget + days */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-neutral-500 mb-1.5 uppercase tracking-wider font-mono">
                  Бюджет (₽)
                </label>
                <input
                  type="number"
                  name="budget"
                  value={form.budget}
                  onChange={handleChange}
                  min={1000}
                  required
                  className="w-full bg-white ring-1 ring-neutral-950/10 rounded-xl px-3 py-2.5 text-neutral-900 focus:outline-none focus:ring-neutral-950/30 transition text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1.5 uppercase tracking-wider font-mono">
                  Дней
                </label>
                <input
                  type="number"
                  name="days"
                  value={form.days}
                  onChange={handleChange}
                  min={1}
                  max={30}
                  required
                  className="w-full bg-white ring-1 ring-neutral-950/10 rounded-xl px-3 py-2.5 text-neutral-900 focus:outline-none focus:ring-neutral-950/30 transition text-sm"
                />
              </div>
            </div>

            {/* dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-neutral-500 mb-1.5 uppercase tracking-wider font-mono">
                  Дата «С» (необязательно)
                </label>
                <input
                  type="date"
                  name="dateFrom"
                  value={form.dateFrom ?? ""}
                  onChange={handleChange}
                  className="w-full bg-white ring-1 ring-neutral-950/10 rounded-xl px-3 py-2.5 text-neutral-900 focus:outline-none focus:ring-neutral-950/30 transition text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1.5 uppercase tracking-wider font-mono">
                  Дата «По» (необязательно)
                </label>
                <input
                  type="date"
                  name="dateTo"
                  value={form.dateTo ?? ""}
                  onChange={handleChange}
                  className="w-full bg-white ring-1 ring-neutral-950/10 rounded-xl px-3 py-2.5 text-neutral-900 focus:outline-none focus:ring-neutral-950/30 transition text-sm"
                />
              </div>
            </div>

            {/* from + people */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-neutral-500 mb-1.5 uppercase tracking-wider font-mono">
                  Откуда едете
                </label>
                <input
                  type="text"
                  name="startCity"
                  value={form.startCity}
                  onChange={handleChange}
                  required
                  placeholder="Москва"
                  className="w-full bg-white ring-1 ring-neutral-950/10 rounded-xl px-3 py-2.5 text-neutral-900 focus:outline-none focus:ring-neutral-950/30 transition text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1.5 uppercase tracking-wider font-mono">
                  Кол-во человек
                </label>
                <input
                  type="number"
                  name="peopleCount"
                  value={form.peopleCount}
                  onChange={handleChange}
                  min={1}
                  required
                  className="w-full bg-white ring-1 ring-neutral-950/10 rounded-xl px-3 py-2.5 text-neutral-900 focus:outline-none focus:ring-neutral-950/30 transition text-sm"
                />
              </div>
            </div>

            {/* distance */}
            <div>
              <label className="block text-xs text-neutral-500 mb-2 uppercase tracking-wider font-mono">
                Расстояние
              </label>
              <div className="flex gap-2 flex-wrap">
                {DISTANCE_OPTIONS.map((opt) => (
                  <RadioPill
                    key={opt.value}
                    name="distancePreference"
                    value={opt.value}
                    checked={form.distancePreference === opt.value}
                    onChange={handleChange}
                    label={opt.label}
                  />
                ))}
              </div>
            </div>

            {/* style */}
            <div>
              <label className="block text-xs text-neutral-500 mb-2 uppercase tracking-wider font-mono">
                Стиль поездки
              </label>
              <div className="flex gap-2 flex-wrap">
                {STYLE_OPTIONS.map((opt) => (
                  <RadioPill
                    key={opt.value}
                    name="tripStyle"
                    value={opt.value}
                    checked={form.tripStyle === opt.value}
                    onChange={handleChange}
                    label={opt.label}
                  />
                ))}
              </div>
            </div>

            {/* priority */}
            <div>
              <label className="block text-xs text-neutral-500 mb-2 uppercase tracking-wider font-mono">
                Приоритет
              </label>
              <div className="flex gap-2 flex-wrap">
                {PRIORITY_OPTIONS.map((opt) => (
                  <RadioPill
                    key={opt.value}
                    name="priority"
                    value={opt.value}
                    checked={form.priority === opt.value}
                    onChange={handleChange}
                    label={opt.label}
                  />
                ))}
              </div>
            </div>

            {/* constraints */}
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5 uppercase tracking-wider font-mono">
                Ограничения и пожелания
              </label>
              <textarea
                name="constraints"
                value={form.constraints}
                onChange={handleChange}
                rows={3}
                placeholder="Например: есть дети 5 лет, без личного авто, вегетарианское питание..."
                className="w-full bg-white ring-1 ring-neutral-950/10 rounded-xl px-3 py-2.5 text-neutral-900 focus:outline-none focus:ring-neutral-950/30 transition resize-none text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-neutral-900 hover:bg-neutral-700 disabled:bg-neutral-200 disabled:text-neutral-400 text-white font-medium py-3 rounded-full transition-all duration-200 flex items-center justify-center gap-2 text-sm"
            >
              {loading ? "Генерирую..." : "Создать 3 варианта маршрута"}
            </button>
          </form>
        </div>
      </section>

      {/* ── RESULTS ── */}
      {(loading || result || error) && (
        <>
          <div className="canvas-grid-line" />
          <section id="results" className="border-x border-neutral-200 max-w-[1280px] mx-auto">
            <div className="px-6 py-16">
              {error && (
                <div className="max-w-2xl bg-red-50 ring-1 ring-red-200 rounded-2xl p-5 text-red-700">
                  <p className="font-medium mb-1">Ошибка</p>
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {loading && <LoaderState />}

              {result && (
                <div className="space-y-12">
                  {/* destination + summary + share/pdf buttons */}
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <h2 className="text-3xl md:text-4xl font-[550] tracking-tight">
                        <span className="text-neutral-900">{result.destination}.</span>{" "}
                        <span className="text-neutral-400">{result.summary}</span>
                      </h2>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={handleShare}
                        className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-medium bg-white ring-1 ring-neutral-950/10 text-neutral-700 hover:ring-neutral-950/20 transition"
                      >
                        Поделиться
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-medium bg-white ring-1 ring-neutral-950/10 text-neutral-700 hover:ring-neutral-950/20 transition"
                      >
                        Скачать PDF
                      </button>
                    </div>
                  </div>

                  {/* Duolingo cards + tier tabs */}
                  <div>
                    <DuolingoCards
                      variants={result.variants}
                      activeTier={activeTier}
                      onSelect={setActiveTier}
                    />

                    <div className="flex gap-2 mb-8 flex-wrap">
                      {(["budget", "balanced", "comfort"] as const).map((tier) => (
                        <button
                          key={tier}
                          onClick={() => setActiveTier(tier)}
                          className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                            activeTier === tier
                              ? "bg-neutral-900 text-white"
                              : "bg-white ring-1 ring-neutral-950/10 text-neutral-600 hover:ring-neutral-950/20"
                          }`}
                        >
                          {TIER_LABELS[tier]}
                        </button>
                      ))}
                    </div>

                    {/* all 3 cards on desktop, active on mobile */}
                    <div id="variant-detail" className="hidden lg:grid lg:grid-cols-3 gap-6">
                      {result.variants.map((v) => (
                        <VariantCard
                          key={v.tier}
                          variant={v}
                          recommended={v.tier === "balanced"}
                          destination={result.destination}
                        />
                      ))}
                    </div>
                    {/* mobile: show active variant */}
                    <div id="variant-detail" className="lg:hidden">
                      {activeVariant && (
                        <VariantCard
                          variant={activeVariant}
                          recommended={activeVariant.tier === "balanced"}
                          destination={result.destination}
                        />
                      )}
                    </div>
                  </div>

                  {/* Yandex map */}
                  {result.destination && (
                    <div className="rounded-2xl ring-1 ring-neutral-950/10 overflow-hidden bg-neutral-50">
                      <iframe
                        src={`https://yandex.ru/map-widget/v1/?text=${encodeURIComponent(result.destination + ", Россия")}&z=11&l=map`}
                        className="w-full h-[400px] block"
                        title="Карта"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* transport options */}
                  <div>
                    <h3 className="text-2xl font-[550] tracking-tight mb-6 text-neutral-900">
                      Способы добраться до {result.destination}
                    </h3>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {result.transport_options.map((opt, i) => (
                        <TransportCard
                          key={i}
                          opt={opt}
                          destination={result.destination}
                          startCity={form.startCity}
                          dateFrom={form.dateFrom}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-neutral-400 mt-3">
                      * Цены ориентировочные. Актуальные — на Aviasales, Tutu.ru, Яндекс.Путешествия.
                    </p>
                  </div>

                  {/* plan B + notes */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-neutral-950/[0.025] ring-1 ring-neutral-950/5 rounded-2xl p-6">
                      <p className="text-xs font-mono uppercase tracking-wider text-neutral-500 mb-2">Запасной план</p>
                      <p className="text-sm text-neutral-700">{result.plan_b}</p>
                    </div>
                    {result.notes.length > 0 && (
                      <div className="bg-neutral-950/[0.025] ring-1 ring-neutral-950/5 rounded-2xl p-6">
                        <p className="text-xs font-mono uppercase tracking-wider text-neutral-500 mb-2">Заметки</p>
                        <ul className="space-y-2">
                          {result.notes.map((note, i) => (
                            <li key={i} className="flex gap-2 text-sm text-neutral-700">
                              <span className="text-neutral-400 shrink-0">•</span>
                              {note}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* ── HOW IT WORKS ── */}
      <div className="canvas-grid-line" />
      <section id="how" className="border-x border-neutral-200 max-w-[1280px] mx-auto">
        <div className="px-6 py-16">
          <h2 className="text-3xl md:text-4xl font-[550] tracking-tight mb-12">
            <span className="text-neutral-900">Как это работает.</span>{" "}
            <span className="text-neutral-400">Три шага до готового маршрута.</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Заполните форму",
                desc: "Укажите бюджет, стиль поездки, откуда едете и сколько дней. Необязательно знать конкретное место — ИИ предложит направление.",
              },
              {
                step: "02",
                title: "ИИ собирает 3 варианта",
                desc: "За 15–30 секунд Gemini анализирует параметры и формирует три маршрута: бюджетный, сбалансированный и комфортный — с конкретными отелями и ценами.",
              },
              {
                step: "03",
                title: "Бронируете в один клик",
                desc: "Выбираете подходящий вариант. Ссылки на Островок, Tutu.ru и Aviasales для бронирования. Скоро — прямые кнопки бронирования.",
              },
            ].map((item) => (
              <div key={item.step} className="bg-neutral-950/[0.025] ring-1 ring-neutral-950/5 rounded-2xl p-6">
                <p className="text-4xl font-[550] text-neutral-200 mb-4 tracking-tight">{item.step}</p>
                <p className="font-medium text-neutral-900 mb-2">{item.title}</p>
                <p className="text-sm text-neutral-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <div className="canvas-grid-line" />
      <section id="Тарифы" className="border-x border-neutral-200 max-w-[1280px] mx-auto">
        <div className="px-6 py-16">
          <h2 className="text-3xl md:text-4xl font-[550] tracking-tight mb-12">
            <span className="text-neutral-900">Начните бесплатно.</span>{" "}
            <span className="text-neutral-400">Масштабируйте под задачи.</span>
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                name: "Сам себе пилот",
                price: "0 ₽",
                desc: "3 маршрута в месяц, базовые варианты",
                features: ["3 генерации/мес", "3 варианта маршрута", "PDF-выгрузка"],
                featured: false,
              },
              {
                name: "Автопилот Лайт",
                price: "299 ₽/мес",
                desc: "20 маршрутов, экспорт и история",
                features: ["20 генераций/мес", "История маршрутов", "Экспорт в PDF", "Email поддержка"],
                featured: false,
              },
              {
                name: "Автопилот Полный",
                price: "5% с брони",
                desc: "Безлимит + прямое бронирование",
                features: ["Безлимитные генерации", "Прямое бронирование", "Кешбэк на отели", "Приоритетная поддержка"],
                featured: true,
              },
              {
                name: "Автопилот Премиум",
                price: "999 ₽ + 3%",
                desc: "Корпоративные поездки и группы",
                features: ["Групповые поездки", "Корпоративный аккаунт", "API доступ", "Персональный менеджер"],
                featured: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 flex flex-col gap-4 ${
                  plan.featured
                    ? "bg-neutral-900 text-white ring-1 ring-neutral-900"
                    : "bg-neutral-950/[0.025] ring-1 ring-neutral-950/5"
                }`}
              >
                <div>
                  <p className={`text-xs font-mono uppercase tracking-widest mb-2 ${plan.featured ? "text-neutral-400" : "text-neutral-500"}`}>
                    {plan.name}
                  </p>
                  <p className={`text-2xl font-[550] tracking-tight ${plan.featured ? "text-white" : "text-neutral-900"}`}>
                    {plan.price}
                  </p>
                  <p className={`text-xs mt-1 ${plan.featured ? "text-neutral-400" : "text-neutral-500"}`}>{plan.desc}</p>
                </div>
                <ul className="space-y-1.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex gap-2 text-sm ${plan.featured ? "text-neutral-300" : "text-neutral-600"}`}>
                      <span className={plan.featured ? "text-neutral-400" : "text-emerald-600"}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  className={`w-full py-2 rounded-full text-sm font-medium transition ${
                    plan.featured
                      ? "bg-white text-neutral-900 hover:bg-neutral-100"
                      : "bg-neutral-900 text-white hover:bg-neutral-700"
                  }`}
                >
                  Выбрать
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <div className="canvas-grid-line" />
      <section className="border-x border-neutral-200 max-w-[1280px] mx-auto">
        <div className="px-6 py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-[550] tracking-tight mb-6">
            Спланируйте первую поездку за 30 секунд
          </h2>
          <a
            href="#form"
            className="inline-flex items-center px-6 py-3 rounded-full bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 transition"
          >
            Начать бесплатно
          </a>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <div className="canvas-grid-line" />
      <footer className="border-x border-neutral-200 max-w-[1280px] mx-auto">
        <div className="px-6 py-12 grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 font-[550] text-neutral-900 mb-3">
              <span>🗺️</span> AI-Trip
            </div>
            <p className="text-sm text-neutral-500">
              Персональные маршруты по России от искусственного интеллекта.
            </p>
          </div>
          {[
            {
              title: "Продукт",
              links: ["Как работает", "Тарифы", "API"],
            },
            {
              title: "Компания",
              links: ["О проекте", "Команда", "Контакты"],
            },
            {
              title: "Соцсети",
              links: ["Telegram", "VK", "Instagram"],
            },
          ].map((col) => (
            <div key={col.title}>
              <p className="text-xs font-mono uppercase tracking-wider text-neutral-500 mb-3">
                {col.title}
              </p>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-sm text-neutral-600 hover:text-neutral-900 transition">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-neutral-200 px-6 py-4">
          <p className="text-xs text-neutral-400">© 2026 AI-Trip · Дипломный проект УТМН</p>
        </div>
      </footer>
    </div>
  );
}
