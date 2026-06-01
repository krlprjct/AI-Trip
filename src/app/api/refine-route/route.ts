import { NextRequest, NextResponse } from "next/server";
import { TravelFormSchema, RouteVariantSchema } from "@/lib/schema";
import { SYSTEM_PROMPT } from "@/lib/prompt";
import { z } from "zod";

export const maxDuration = 60;

const RefineRequestSchema = z.object({
  variant: RouteVariantSchema,
  instruction: z.string().min(1),
  form: TravelFormSchema,
});

function extractJSON(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text.trim();
}

function getGeminiKeys(): string[] {
  const multi = process.env.GEMINI_API_KEYS;
  if (multi) return multi.split(",").map((k) => k.trim()).filter(Boolean);
  const single = process.env.GEMINI_API_KEY;
  return single ? [single] : [];
}

async function geminiRequest(
  apiKey: string,
  model: string,
  prompt: string
): Promise<{ text: string; rateLimited: boolean }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 16384 },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[refine Gemini ${model}] ${res.status}:`, errText.slice(0, 150));
      if (res.status === 429) return { text: "", rateLimited: true };
      if (res.status >= 500) return { text: "", rateLimited: false };
      throw new Error(`Gemini ${res.status}: ${errText.slice(0, 150)}`);
    }

    const data = await res.json();
    return { text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "", rateLimited: false };
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      console.error(`[refine Gemini ${model}] timeout`);
      return { text: "", rateLimited: false };
    }
    throw err;
  }
}

async function callGemini(prompt: string, useFlash = false): Promise<string> {
  const keys = getGeminiKeys();
  if (keys.length === 0) return "";
  const model = useFlash ? "gemini-2.5-flash" : "gemini-2.5-flash-lite";
  for (const key of keys) {
    const { text, rateLimited } = await geminiRequest(key, model, prompt);
    if (text) return text;
    if (!rateLimited) return "";
  }
  return "";
}

async function callOpenRouter(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return "";
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 20000,
      }),
      signal: AbortSignal.timeout(50000),
    });
    if (!res.ok) {
      console.error(`[refine OpenRouter] ${res.status}:`, (await res.text()).slice(0, 200));
      return "";
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      console.error("[refine OpenRouter] timeout");
      return "";
    }
    throw err;
  }
}

async function callDeepSeek(systemPrompt: string, userPrompt: string): Promise<string> {
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
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 20000,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      console.error(`[refine DeepSeek] ${res.status}:`, (await res.text()).slice(0, 200));
      return "";
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      console.error("[refine DeepSeek] timeout");
      return "";
    }
    throw err;
  }
}

function tryParseAndValidate(rawText: string) {
  const jsonString = extractJSON(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return null;
  }
  const validated = RouteVariantSchema.safeParse(parsed);
  if (!validated.success) return null;
  return validated.data;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RefineRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Некорректные данные: " + parsed.error.issues[0]?.message },
        { status: 400 }
      );
    }

    const { variant, instruction, form } = parsed.data;

    const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
    const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;
    const hasGemini = getGeminiKeys().length > 0;

    if (!hasOpenRouter && !hasDeepSeek && !hasGemini) {
      // Mock: return same variant
      return NextResponse.json(variant);
    }

    const RETRY_PREFIX =
      "КРИТИЧНО: предыдущий ответ был невалидным. Верни ТОЛЬКО валидный JSON одного варианта, начинающийся с { и заканчивающийся }. Никакого markdown.\n\n";

    const buildPrompt = (prefix = "") =>
      `${prefix}Вот текущий вариант маршрута туриста:
${JSON.stringify(variant, null, 2)}

Параметры поездки:
- Бюджет: ${form.budget.toLocaleString("ru")} ₽
- Дней: ${form.days}
- Откуда: ${form.startCity}
- Кол-во человек: ${form.peopleCount}

Пользователь просит: "${instruction}"

Перегенерируй вариант с учётом просьбы, сохрани JSON-структуру (та же что у RouteVariantSchema). Верни ТОЛЬКО JSON одного варианта (без обёртки массива, без поля variants).`;

    // Каскад: OpenRouter → DeepSeek → Gemini Lite → Gemini Flash
    let result = null;
    const attempts: Array<() => Promise<string>> = [];
    if (hasDeepSeek) attempts.push(() => callDeepSeek(SYSTEM_PROMPT, buildPrompt()));
    if (hasOpenRouter) attempts.push(() => callOpenRouter(SYSTEM_PROMPT, buildPrompt()));
    if (hasGemini) {
      attempts.push(() => callGemini(buildPrompt()));
      attempts.push(() => callGemini(buildPrompt(RETRY_PREFIX), true));
    }
    // Worst-case: DeepSeek 20s + Lite 15s + Flash 15s = 50s < maxDuration 60s

    for (const attempt of attempts) {
      const raw = await attempt();
      if (raw) {
        result = tryParseAndValidate(raw);
        if (result) break;
      }
    }

    if (!result) {
      return NextResponse.json(
        { error: "Модель вернула некорректный JSON. Попробуйте ещё раз через 5 секунд." },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Неизвестная ошибка";
    console.error("[refine-route]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
