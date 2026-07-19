# Codex Task C1 — SatuKit pure-logic libraries + unit tests

You are implementing part of **SatuKit** (Next.js 14 + TypeScript hackathon app). Build ONLY the pure-logic files and their Vitest tests below. No network, no DB, no React, no side effects. Work inside the existing repo. Return the full contents of each file and stop.

Authoritative spec (read if accessible): `docs/TRD.md` §6 (validation), §7 (price), §10 (tests); `docs/PRD.md` FR-5, FR-7.

## Shared contract — already defined in `lib/schemas.ts`. DO NOT redefine or edit it. Import types from it. For reference, it exports:

```ts
export type Lang = "ru" | "kk";
export type FormInput = { product_name: string; facts?: string; region?: string; price?: number; cost?: number; margin_percent?: number; language: Lang };
export type AiOutput = {
  headline: string; description: string; instagram_caption: string; whatsapp_message: string;
  buyer_faq: { question: string; answer: string }[];
  presentation_tips: string[];
  confirmation_required: { claim: string; reason: string }[];
  image_alt_text: string;
};
export type PublicCard = { product_name: string; description: string; price_minor: number | null; region: string | null; image_url: string; whatsapp_e164: string; language: Lang };
```

## Deliver exactly these files

### `lib/validate.ts`
- `export function validateOutput(o: AiOutput, form: FormInput): string[]` — returns a list of issue codes ([] = valid). Rules (TRD §6):
  - Guard every field present/non-empty.
  - `buyer_faq` length must be 3–5 → else `faq_count`.
  - `presentation_tips` length ≤3 → else `tips_count`.
  - Language: if `form.language === 'kk'`, the combined output text MUST contain ≥1 Kazakh-specific letter `[әіңғүұқөһ]` (case-insensitive) → else `lang_kk`. For `ru`: no check.
  - `instagram_caption` ≤2200 → else `ig_len`; `whatsapp_message` ≤700 → else `wa_len`.
  - Prohibited-category scan: certifications/сертификат, ingredients/состав, origin/происхождение, stock/наличие, delivery/доставка, medical-health/лечебн|польза для здоровья, discounts/скидк, guarantees/гарант. If a category appears in `description + instagram_caption + whatsapp_message` but the seller did NOT supply it in `form.facts` (case-insensitive substring/regex), emit `prohibited:<category>`. Pragmatic regex is fine.
- `export function buildRepairHint(issues: string[]): string` — maps issue codes → a single Russian corrective instruction string for the model (e.g. `faq_count` → "дай ровно 3–5 вопросов покупателя"; `prohibited:delivery` → "убери утверждения о доставке — продавец их не давал").
- `export function filterPublicPayload(row): PublicCard` — given a DB-shaped product row `{ product_name, generated_output (AiOutput, possibly edited), price_minor, region, image_url, whatsapp_e164, language }`, return ONLY public fields. NEVER include cost, margin, edit_token, or any `confirmation_required` text. `description` comes from the (edited) generated_output.description.

### `lib/price.ts`
- `export function priceFloorMinor(costMinor: number, marginPercent: number): number | null` — `floor = cost / (1 - margin/100)`, in minor units (tiyn), rounded UP to a whole tenge (i.e. round up to nearest 100 minor). Return `null` if `costMinor <= 0` or `!(0 < marginPercent < 95)`.

### `lib/wa.ts`
- `export function toE164(raw: string, defaultCountry?: "KZ"): string | null` — normalize Kazakhstan numbers to `+7XXXXXXXXXX` (handle `+7…`, `8…`, spaces, dashes, parentheses; 11 digits). Return `null` if invalid.
- `export function waLink(e164: string, message: string): string` — `https://wa.me/<digits-without-plus>?text=<encodeURIComponent(message)>`.

### `lib/__tests__/logic.test.ts` (Vitest)
Cover: validateOutput passes a good fixture and flags each rule (faq_count, tips_count, lang_kk, ig_len, wa_len, a prohibited category not in facts); buildRepairHint returns non-empty for known codes; priceFloorMinor formula + round-up + bounds (cost≤0, margin 0/95/120); toE164 for `+77001234567`, `87001234567`, `+7 700 123 45 67`, invalid; waLink encoding; filterPublicPayload excludes cost/margin/edit_token.

## Constraints
- Pure TypeScript. Import types from `lib/schemas.ts` (already present). No other new deps.
- `npm test` (Vitest, already configured) must pass.
- Do NOT touch any other file (schemas.ts, page.tsx, API routes, db.ts, llm.ts). Return each file path + full contents.
