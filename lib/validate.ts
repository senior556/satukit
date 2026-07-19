import type { Card } from "./types";

const CTA = /(директ|напиши|напишите|заказ|whatsapp|ватсап|пишите|звони|бронир|оформ|直)/i;

export function validateCard(c: Card): string[] {
  const issues: string[] = [];
  if (!c.headline?.trim()) issues.push("no_headline");
  if (!c.description || c.description.trim().length < 40) issues.push("short_description");
  if (!c.priceHint?.trim()) issues.push("no_price");
  if (!Array.isArray(c.hashtags) || c.hashtags.length < 3) issues.push("few_hashtags");
  const body = `${c.instagramText ?? ""} ${c.whatsappText ?? ""}`;
  if (!CTA.test(body)) issues.push("no_cta");
  return issues;
}

const HINTS: Record<string, string> = {
  no_headline: "добавь цепляющий заголовок-хук первой строкой",
  short_description: "сделай описание длиннее и через выгоды для покупателя",
  no_price: "добавь подсказку по цене в тенге",
  few_hashtags: "дай 5–10 релевантных хэштегов",
  no_cta: "добавь явный призыв: написать в директ / заказать в WhatsApp",
};

export function buildRepairHint(issues: string[]): string {
  return issues.map((i) => HINTS[i]).filter(Boolean).join("; ");
}
