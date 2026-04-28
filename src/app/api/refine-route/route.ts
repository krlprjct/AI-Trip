import { NextRequest, NextResponse } from "next/server";
import { TravelFormSchema, RouteVariantSchema } from "@/lib/schema";
import { SYSTEM_PROMPT } from "@/lib/prompt";
import { z } from "zod";

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

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const model = "gemini-2.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(55000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
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

    if (!process.env.GEMINI_API_KEY) {
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

    // First attempt
    let raw = await callGemini(buildPrompt());
    let result = raw ? tryParseAndValidate(raw) : null;

    // Retry
    if (!result) {
      console.warn("[refine-route] First attempt invalid, retrying...");
      raw = await callGemini(buildPrompt(RETRY_PREFIX));
      result = raw ? tryParseAndValidate(raw) : null;
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
