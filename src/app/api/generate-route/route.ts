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

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const model = "gemini-2.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
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
    signal: AbortSignal.timeout(55000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
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

    // 2. Mock mode — если нет ключей
    const hasGemini = !!process.env.GEMINI_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;

    if (!hasGemini && !hasOpenAI) {
      // Simulate delay for realism
      await new Promise((r) => setTimeout(r, 1500));
      return NextResponse.json(MOCK_ROUTE);
    }

    // 3. Build prompt & call LLM
    const userPrompt = buildUserPrompt(form);
    let rawText: string;

    if (hasGemini) {
      rawText = await callGemini(userPrompt);
      console.log("RAW:", rawText);
    } else {
      rawText = await callOpenAI(userPrompt);
    }

    if (!rawText) {
      throw new Error("Модель вернула пустой ответ");
    }

    // 4. Extract & parse JSON
    const jsonString = extractJSON(rawText);
    let parsed: unknown;

    try {
      parsed = JSON.parse(jsonString);
    } catch {
      console.error("Raw LLM output:", rawText);
      throw new Error("Не удалось разобрать JSON от модели. Попробуйте ещё раз.");
    }

    // 5. Validate against schema
    const validated = RouteResultSchema.safeParse(parsed);

    if (!validated.success) {
      console.error("Schema validation failed:", validated.error.issues);
      throw new Error("Модель вернула некорректную структуру. Попробуйте ещё раз.");
    }

    return NextResponse.json(validated.data);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Неизвестная ошибка сервера";

    console.error("[generate-route]", message);

    const status = message.includes("Некорректные") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
