import { NextResponse } from "next/server";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/prompt";
import { RouteResultSchema } from "@/lib/schema";

export const maxDuration = 60;

function extractJSON(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text.trim();
}

// Диагностический эндпоинт. ?test=deepseek делает реальный пробный вызов.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const test = url.searchParams.get("test");

  const geminiKeyCount = process.env.GEMINI_API_KEYS
    ? process.env.GEMINI_API_KEYS.split(",").map((k) => k.trim()).filter(Boolean).length
    : process.env.GEMINI_API_KEY
    ? 1
    : 0;

  const base = {
    version: "openrouter-cascade-v4",
    hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
    geminiKeyCount,
    hasDeepSeekKey: !!process.env.DEEPSEEK_API_KEY,
    deployedAt: "2026-06-01",
  };

  if (test === "llamafull") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ ...base, llama: "NO KEY" });
    const userPrompt = buildUserPrompt({
      budget: 45000, days: 7, startCity: "Тюмень", distancePreference: "russia",
      tripStyle: "active", peopleCount: 3, constraints: "семья альпинистов, активный отдых",
      priority: "destination", dateFrom: "", dateTo: "",
    });
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "meta-llama/llama-3.3-70b-instruct:free",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 20000,
        }),
        signal: AbortSignal.timeout(50000),
      });
      const status = res.status;
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content ?? "";
      const finishReason = data.choices?.[0]?.finish_reason ?? "?";
      const extracted = extractJSON(raw);
      let zodErr = null;
      let parseErr = null;
      try {
        const parsed = JSON.parse(extracted);
        const v = RouteResultSchema.safeParse(parsed);
        if (!v.success) zodErr = v.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`);
      } catch (e) {
        parseErr = e instanceof Error ? e.message : "parse fail";
      }
      return NextResponse.json({
        ...base,
        llama: {
          status, finishReason, rawLength: raw.length,
          rawStart: raw.slice(0, 200), rawEnd: raw.slice(-200),
          parseErr, zodErr,
        },
      });
    } catch (err) {
      return NextResponse.json({ ...base, llama: err instanceof Error ? `${err.name}: ${err.message}` : "err" });
    }
  }

  if (test === "models") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ ...base, models: "NO KEY" });
    try {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(25000),
      });
      const data = await res.json();
      const freeModels = (data.data ?? [])
        .filter((m: { id: string }) => m.id.endsWith(":free"))
        .map((m: { id: string }) => m.id)
        .sort();
      return NextResponse.json({ ...base, freeModelCount: freeModels.length, freeModels });
    } catch (err) {
      return NextResponse.json({ ...base, models: err instanceof Error ? err.message : "err" });
    }
  }

  if (test === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ ...base, openrouter: "NO KEY" });
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "deepseek/deepseek-v4-flash:free",
          messages: [{ role: "user", content: 'Верни JSON: {"ok": true}' }],
          max_tokens: 50,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(25000),
      });
      return NextResponse.json({
        ...base,
        openrouter: { status: res.status, body: (await res.text()).slice(0, 600) },
      });
    } catch (err) {
      return NextResponse.json({
        ...base,
        openrouter: { error: err instanceof Error ? `${err.name}: ${err.message}` : "unknown" },
      });
    }
  }

  if (test === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return NextResponse.json({ ...base, deepseek: "NO KEY" });
    try {
      const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "user", content: 'Верни JSON: {"ok": true}' }],
          max_tokens: 50,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(25000),
      });
      const status = res.status;
      const bodyText = await res.text();
      return NextResponse.json({
        ...base,
        deepseek: { status, body: bodyText.slice(0, 500) },
      });
    } catch (err) {
      return NextResponse.json({
        ...base,
        deepseek: { error: err instanceof Error ? `${err.name}: ${err.message}` : "unknown" },
      });
    }
  }

  return NextResponse.json(base);
}
