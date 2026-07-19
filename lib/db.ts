import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { StoredKit } from "./schemas";

const BUCKET = "product-images";

let _c: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!_c) {
    _c = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
  }
  return _c;
}

export type ProductRow = {
  id: string;
  status: "draft" | "published";
  language: "ru" | "kk";
  product_name: string;
  facts: string | null;
  region: string | null;
  price_minor: number | null;
  cost_minor: number | null;
  margin_percent: number | null;
  whatsapp_e164: string | null;
  image_url: string;
  generated_output: StoredKit;
  confirmed_claims: string[];
  public_slug: string | null;
  edit_token: string;
  published_at: string | null;
  model_name: string | null;
};

export async function uploadImage(imageBase64: string): Promise<string> {
  const m = imageBase64.match(/^data:(image\/\w+);base64,(.*)$/);
  const b64 = m?.[2] ?? imageBase64;
  const bytes = Buffer.from(b64, "base64");
  const path = `products/${crypto.randomUUID()}.jpg`;
  const { error } = await db().storage.from(BUCKET).upload(path, bytes, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function insertProduct(
  row: Partial<ProductRow>,
): Promise<{ id: string; edit_token: string; image_url: string }> {
  const { data, error } = await db()
    .from("products")
    .insert(row)
    .select("id, edit_token, image_url")
    .single();
  if (error) throw error;
  return data as { id: string; edit_token: string; image_url: string };
}

export async function getProduct(id: string): Promise<ProductRow | null> {
  const { data } = await db().from("products").select("*").eq("id", id).maybeSingle();
  return (data as ProductRow) ?? null;
}

export async function updateProduct(id: string, patch: Partial<ProductRow>): Promise<void> {
  const { error } = await db().from("products").update(patch).eq("id", id);
  if (error) throw error;
}

export async function getPublicBySlug(slug: string): Promise<ProductRow | null> {
  const { data } = await db()
    .from("products")
    .select("*")
    .eq("public_slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return (data as ProductRow) ?? null;
}

export async function insertFeedback(f: Record<string, unknown>): Promise<void> {
  const { error } = await db().from("feedback").insert(f);
  if (error) throw error;
}

export async function insertEvent(e: Record<string, unknown>): Promise<void> {
  await db().from("events").insert(e); // fire-and-forget; ignore errors
}

export async function health(): Promise<boolean> {
  const { error } = await db().from("products").select("id").limit(1);
  return !error;
}
