import { NextRequest, NextResponse } from "next/server";
import { generateCard } from "@/lib/llm";
import { validateCard, buildRepairHint } from "@/lib/validate";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, note, lang } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ error: "no image" }, { status: 400 });
    }

    let card = await generateCard(imageBase64, note ?? "", lang ?? "ru");
    let issues = validateCard(card);
    if (issues.length) {
      card = await generateCard(imageBase64, note ?? "", lang ?? "ru", buildRepairHint(issues));
      issues = validateCard(card);
    }
    return NextResponse.json({ card, issues });
  } catch (e) {
    console.error("generate failed", e);
    return NextResponse.json({ error: "generation failed" }, { status: 500 });
  }
}
