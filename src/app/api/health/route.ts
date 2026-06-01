import { NextResponse } from "next/server";

// Диагностический эндпоинт — не трогает Gemini, показывает какая версия кода на проде
export async function GET() {
  return NextResponse.json({
    version: "fix-429-retry-v2",
    modelStrategy: "lite-then-flash-on-retry",
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    hasDeepSeekKey: !!process.env.DEEPSEEK_API_KEY,
    deployedAt: "2026-06-01",
  });
}
