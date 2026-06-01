import { NextRequest, NextResponse } from "next/server";
import { TravelFormSchema, RouteResultSchema } from "@/lib/schema";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/prompt";
import { MOCK_ROUTE } from "@/lib/mock";

// ─── helpers ────────────────────────────────────────────────────────────────

function extractJSON(text: string): string {
  // Strip markdown code fences if model wrapped JSON in them
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Find first { … last }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);

  return text.trim();
}

// ─── Gemini ──────────────────────────────────────────────────────────────────

async function callGemini(prompt: string, useFlash = false): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "";

  const model = useFlash ? "gemini-2.5-flash" : "gemini-2.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 32768,
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      // 429 (rate limit) / 5xx — возвращаем пустую строку чтобы сработал retry на Flash
      // 400 (bad request) — фатальная ошибка, бросаем
      const errText = await res.text();
      console.error(`[Gemini ${model}] ${res.status}:`, errText.slice(0, 200));
      if (res.status === 429 || res.status >= 500) return "";
      throw new Error(`Gemini ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  } catch (err) {
    // Сетевые/timeout ошибки — даём retry шанс
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      console.error(`[Gemini ${model}] timeout`);
      return "";
    }
    throw err;
  }
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────

async function callOpenAI(prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 429 || res.status >= 500) return "";
    throw new Error(`OpenAI error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ─── DeepSeek (основная модель, без дневного лимита, доступна из РФ) ────────────

async function callDeepSeek(prompt: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return "";

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 8192,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(40000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[DeepSeek] ${res.status}:`, errText.slice(0, 200));
      return "";
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      console.error("[DeepSeek] timeout");
      return "";
    }
    throw err;
  }
}

// ─── tryParseAndValidate ──────────────────────────────────────────────────────

function tryParseAndValidate(rawText: string) {
  const jsonString = extractJSON(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return null;
  }
  const validated = RouteResultSchema.safeParse(parsed);
  if (!validated.success) return null;
  return validated.data;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 1. Parse & validate input
    const body = await req.json();
    const formParsed = TravelFormSchema.safeParse(body);

    if (!formParsed.success) {
      return NextResponse.json(
        { error: "Некорректные данные формы: " + formParsed.error.issues[0]?.message },
        { status: 400 }
      );
    }

    const form = formParsed.data;

    // 2. Mock mode — если нет ни одного ключа
    const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;
    const hasGemini = !!process.env.GEMINI_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;

    if (!hasDeepSeek && !hasGemini && !hasOpenAI) {
      await new Promise((r) => setTimeout(r, 1500));
      return NextResponse.json(MOCK_ROUTE);
    }

    // 3. Build prompt & call LLM с каскадом провайдеров
    const userPrompt = buildUserPrompt(form);
    const RETRY_PREFIX =
      "КРИТИЧНО: предыдущий ответ был невалидным. Верни ТОЛЬКО валидный JSON, начинающийся с { и заканчивающийся }. Никакого markdown, никаких пояснений.\n\n";

    let validated = null;

    // Каскад: DeepSeek (без дневного лимита) → Gemini Lite → Gemini Flash → OpenAI
    // Каждый следующий вызывается только если предыдущий не дал валидный JSON
    const attempts: Array<() => Promise<string>> = [];
    if (hasDeepSeek) attempts.push(() => callDeepSeek(userPrompt));
    if (hasGemini) {
      attempts.push(() => callGemini(userPrompt));            // Lite
      attempts.push(() => callGemini(RETRY_PREFIX + userPrompt, true)); // Flash
    }
    if (hasOpenAI) attempts.push(() => callOpenAI(userPrompt));
    // DeepSeek retry со строгим префиксом в самом конце, если он есть
    if (hasDeepSeek) attempts.push(() => callDeepSeek(RETRY_PREFIX + userPrompt));

    for (const attempt of attempts) {
      const raw = await attempt();
      if (raw) {
        validated = tryParseAndValidate(raw);
        if (validated) break;
      }
    }

    if (!validated) {
      return NextResponse.json(
        { error: "Модель вернула некорректный JSON. Попробуйте ещё раз через 5 секунд." },
        { status: 500 }
      );
    }

    return NextResponse.json(validated);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Неизвестная ошибка сервера";

    console.error("[generate-route]", message);

    const status = message.includes("Некорректные") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
