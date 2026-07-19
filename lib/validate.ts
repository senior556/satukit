import type { AiOutput, FormInput, PublicCard, Lang } from "./schemas";

// ---- Prohibited claim categories (TRD §6) --------------------------------
// A category is "prohibited" when it appears in the generated public text but
// the seller never supplied it in `form.facts`. Root-substring regexes are
// used deliberately (no \b word boundaries — those do not work for Cyrillic).
const PROHIBITED: { category: string; re: RegExp }[] = [
  { category: "certifications", re: /certif|сертификат/i },
  { category: "ingredients", re: /ingredient|состав/i },
  { category: "origin", re: /origin|происхожд/i },
  { category: "stock", re: /in stock|наличи/i },
  { category: "delivery", re: /deliver|доставк/i },
  { category: "medical", re: /medical|health benefit|лечебн|польза для здоровья/i },
  { category: "discounts", re: /discount|скидк/i },
  { category: "guarantees", re: /guarantee|warranty|гарант/i },
];

// Kazakh-specific letters (case-insensitive).
const KAZAKH_LETTERS = /[әіңғүұқөһ]/i;

/**
 * Validate an AiOutput against the form the seller submitted.
 * Returns a list of issue codes; an empty array means the output is valid.
 */
export function validateOutput(o: AiOutput, form: FormInput): string[] {
  const issues: string[] = [];

  // 1. Presence / non-empty guards.
  const nonEmptyStr = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  if (!o) return ["empty:output"];
  if (!nonEmptyStr(o.headline)) issues.push("empty:headline");
  if (!nonEmptyStr(o.description)) issues.push("empty:description");
  if (!nonEmptyStr(o.instagram_caption)) issues.push("empty:instagram_caption");
  if (!nonEmptyStr(o.whatsapp_message)) issues.push("empty:whatsapp_message");
  if (!nonEmptyStr(o.image_alt_text)) issues.push("empty:image_alt_text");
  if (!Array.isArray(o.buyer_faq)) issues.push("empty:buyer_faq");
  if (!Array.isArray(o.presentation_tips)) issues.push("empty:presentation_tips");
  if (!Array.isArray(o.confirmation_required)) issues.push("empty:confirmation_required");

  // 2. buyer_faq length must be 3–5.
  if (Array.isArray(o.buyer_faq) && (o.buyer_faq.length < 3 || o.buyer_faq.length > 5)) {
    issues.push("faq_count");
  }

  // 3. presentation_tips length must be ≤3.
  if (Array.isArray(o.presentation_tips) && o.presentation_tips.length > 3) {
    issues.push("tips_count");
  }

  const combined = `${o.description ?? ""} ${o.instagram_caption ?? ""} ${o.whatsapp_message ?? ""}`;

  // 4. Kazakh language check.
  if (form.language === "kk") {
    const full = `${combined} ${o.headline ?? ""} ${o.image_alt_text ?? ""}`;
    if (!KAZAKH_LETTERS.test(full)) issues.push("lang_kk");
  }

  // 5. Length limits.
  if (typeof o.instagram_caption === "string" && o.instagram_caption.length > 2200) {
    issues.push("ig_len");
  }
  if (typeof o.whatsapp_message === "string" && o.whatsapp_message.length > 700) {
    issues.push("wa_len");
  }

  // 6. Prohibited-category scan.
  const facts = form.facts ?? "";
  for (const { category, re } of PROHIBITED) {
    if (re.test(combined) && !re.test(facts)) {
      issues.push(`prohibited:${category}`);
    }
  }

  return issues;
}

// ---- Repair hints --------------------------------------------------------
const HINTS: Record<string, string> = {
  faq_count: "дай ровно 3–5 вопросов покупателя",
  tips_count: "оставь не более 3 советов по презентации",
  lang_kk: "напиши весь текст на казахском языке (используй казахские буквы)",
  ig_len: "сократи подпись для Instagram до 2200 символов",
  wa_len: "сократи сообщение WhatsApp до 700 символов",
};

const PROHIBITED_HINTS: Record<string, string> = {
  certifications: "убери утверждения о сертификатах — продавец их не давал",
  ingredients: "убери утверждения о составе — продавец их не давал",
  origin: "убери утверждения о происхождении — продавец их не давал",
  stock: "убери утверждения о наличии — продавец их не давал",
  delivery: "убери утверждения о доставке — продавец их не давал",
  medical: "убери утверждения о лечебных свойствах и пользе для здоровья — продавец их не давал",
  discounts: "убери утверждения о скидках — продавец их не давал",
  guarantees: "убери утверждения о гарантиях — продавец их не давал",
};

/**
 * Map a list of issue codes to a single Russian corrective instruction for
 * the model. Duplicate hints are collapsed.
 */
export function buildRepairHint(issues: string[]): string {
  const parts: string[] = [];
  let emptyAdded = false;

  for (const code of issues) {
    if (code.startsWith("prohibited:")) {
      const cat = code.slice("prohibited:".length);
      parts.push(PROHIBITED_HINTS[cat] ?? `убери неподтверждённые утверждения (${cat})`);
    } else if (code.startsWith("empty:")) {
      if (!emptyAdded) {
        parts.push("заполни все обязательные поля вывода");
        emptyAdded = true;
      }
    } else if (HINTS[code]) {
      parts.push(HINTS[code]);
    }
  }

  return parts.join("; ");
}

// ---- Public payload filter ----------------------------------------------
type ProductRow = {
  product_name: string;
  generated_output: AiOutput;
  price_minor: number | null;
  region: string | null;
  image_url: string;
  whatsapp_e164: string | null;
  language: Lang;
};

/**
 * Reduce a DB-shaped product row to the public card. NEVER exposes cost,
 * margin, edit_token, or any confirmation_required text. `description` comes
 * from the (possibly edited) generated_output.
 */
export function filterPublicPayload(row: ProductRow): PublicCard {
  return {
    product_name: row.product_name,
    description: row.generated_output.description,
    price_minor: row.price_minor,
    region: row.region,
    image_url: row.image_url,
    whatsapp_e164: row.whatsapp_e164 ?? "",
    language: row.language,
  };
}
