import { NextRequest, NextResponse } from "next/server";
import { getProduct, updateProduct, type ProductRow } from "@/lib/db";

export const maxDuration = 10;

const TEXT_KEYS = ["headline", "description", "instagram_caption", "whatsapp_message"] as const;

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const editToken: unknown = body?.editToken;
    const fields = body?.fields;
    const confirmedClaims = body?.confirmedClaims;

    const row = await getProduct(id);
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!editToken || editToken !== row.edit_token) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const patch: Partial<ProductRow> = {};
    if (fields && typeof fields === "object") {
      const output = { ...row.generated_output };
      for (const k of TEXT_KEYS) {
        if (typeof fields[k] === "string") output[k] = fields[k];
      }
      patch.generated_output = output;
      if (typeof fields.price_minor === "number") patch.price_minor = fields.price_minor;
    }
    if (Array.isArray(confirmedClaims)) {
      patch.confirmed_claims = confirmedClaims.filter((c: unknown) => typeof c === "string");
    }

    if (Object.keys(patch).length) await updateProduct(id, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("patch failed", e);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
}
