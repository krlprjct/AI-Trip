# 🗺️ AI Travel Route Generator

Дипломный MVP-проект. Пользователь заполняет форму — AI генерирует персональный маршрут путешествия.

## Стек

- **Next.js 14** (App Router)
- **Tailwind CSS** — стилизация
- **Zod** — валидация данных
- **Gemini / OpenAI** — генерация маршрута

## Быстрый старт

```bash
# 1. Установить зависимости
npm install

# 2. Настроить переменные окружения
cp .env.example .env.local
# Вставьте GEMINI_API_KEY или OPENAI_API_KEY в .env.local

# 3. Запустить
npm run dev
```

Открыть: http://localhost:3000

> **Без ключей** приложение работает в mock-режиме — возвращает готовый пример маршрута в Петербург.

## Структура проекта

```
ai-travel-route/
├── app/
│   ├── page.tsx                    # UI: форма + вывод результата
│   ├── layout.tsx                  # HTML-обёртка
│   ├── globals.css                 # Tailwind import
│   └── api/
│       └── generate-route/
│           └── route.ts            # API: валидация → LLM → JSON
├── lib/
│   ├── schema.ts                   # Zod-схемы (форма + ответ AI)
│   ├── prompt.ts                   # Системный и пользовательский промпт
│   └── mock.ts                     # Mock-маршрут для demo без ключа
├── .env.example
├── next.config.js
├── tailwind.config.js
└── package.json
```

## Архитектура потока данных

```
Пользователь заполняет форму (page.tsx)
    ↓ POST /api/generate-route
Валидация входных данных (Zod — TravelFormSchema)
    ↓
Если ключ есть → вызов Gemini/OpenAI
Если нет → Mock-ответ
    ↓
Парсинг JSON (extractJSON helper)
    ↓
Валидация ответа (Zod — RouteResultSchema)
    ↓
Возврат данных → рендер в UI
```

## Что показать на демо (3 минуты)

1. **Форма** (30 сек) — показать все поля, объяснить логику
2. **Генерация** (60 сек) — запустить с реальным ключом или mock
3. **Результат** (60 сек) — пройтись по блокам: сводка, бюджет, дни, жильё
4. **Технически** (30 сек) — показать `route.ts` и `schema.ts`, подчеркнуть Zod-валидацию

## Следующие шаги (после диплома)

- [ ] Авторизация (NextAuth)
- [ ] Сохранение маршрутов (Prisma + PostgreSQL)
- [ ] Интеграция с Aviasales/Booking API
- [ ] Экспорт в PDF
- [ ] Карта маршрута (Яндекс.Карты API)
