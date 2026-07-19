import { NextRequest, NextResponse } from "next/server";
import { FormSchema } from "@/lib/schemas";
import { generateKit, AI_MODEL_NAME } from "@/lib/llm";
import { validateOutput, buildRepairHint } from "@/lib/validate";
import { uploadImage, insertProduct } from "@/lib/db";

export const maxDuration = 75;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 422 });
  }
  const { imageBase64, form } = (body ?? {}) as { imageBase64?: string; form?: unknown };

  if (!imageBase64 || typeof imageBase64 !== "string") {
    return NextResponse.json({ error: "no image" }, { status: 422 });
  }
  if (imageBase64.length > 3_500_000) {
    return NextResponse.json({ error: "image too large" }, { status: 422 });
  }
  const parsed = FormSchema.safeParse(form);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid form" }, { status: 422 });
  }
  const f = parsed.data;

  // Upload image first (its own failure mode)
  let imageUrl: string;
  try {
    imageUrl = await uploadImage(imageBase64);
  } catch (e) {
    console.error("upload failed", e);
    return NextResponse.json({ error: "upload failed" }, { status: 502 });
  }

  // Generate + one repair pass on validation issues
  try {
    let output = await generateKit(imageBase64, f);
    let issues = validateOutput(output, f);
    if (issues.length) {
      output = await generateKit(imageBase64, f, buildRepairHint(issues));
      issues = validateOutput(output, f);
    }

    const row = await insertProduct({
      status: "draft",
      language: f.language,
      product_name: f.product_name,
      facts: f.facts ?? null,
      region: f.region ?? null,
      price_minor: f.price != null ? Math.round(f.price * 100) : null,
      cost_minor: f.cost != null ? Math.round(f.cost * 100) : null,
      margin_percent: f.margin_percent ?? null,
      image_url: imageUrl,
      generated_output: output,
      confirmed_claims: [],
      model_name: AI_MODEL_NAME,
    });

    return NextResponse.json({
      id: row.id,
      editToken: row.edit_token,
      imageUrl,
      output,
      issues,
    });
  } catch (e) {
    console.error("generation failed", e);
    return NextResponse.json({ error: "generation failed" }, { status: 502 });
  }
}
