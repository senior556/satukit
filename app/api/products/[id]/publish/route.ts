import { NextRequest, NextResponse } from "next/server";
import { getProduct, updateProduct } from "@/lib/db";
import { toE164 } from "@/lib/wa";

export const maxDuration = 10;

function makeSlug(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { editToken, whatsapp, confirmAccurate } = await req.json();

    const row = await getProduct(id);
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!editToken || editToken !== row.edit_token) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (confirmAccurate !== true) {
      return NextResponse.json({ error: "confirmation required" }, { status: 422 });
    }
    const e164 = toE164(String(whatsapp ?? ""));
    if (!e164) {
      return NextResponse.json({ error: "invalid whatsapp" }, { status: 422 });
    }

    const base = process.env.APP_BASE_URL || new URL(req.url).origin;

    // Idempotent: if already has a slug, return it (optionally refresh the number).
    if (row.public_slug) {
      if (row.whatsapp_e164 !== e164) await updateProduct(id, { whatsapp_e164: e164 });
      return NextResponse.json({ slug: row.public_slug, url: `${base}/p/${row.public_slug}` });
    }

    const slug = makeSlug();
    await updateProduct(id, {
      status: "published",
      whatsapp_e164: e164,
      public_slug: slug,
      published_at: new Date().toISOString(),
    });
    return NextResponse.json({ slug, url: `${base}/p/${slug}` });
  } catch (e) {
    console.error("publish failed", e);
    return NextResponse.json({ error: "publish failed" }, { status: 500 });
  }
}
