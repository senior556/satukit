# Codex Task C2 — SatuKit UI flow (client)

Implement the SatuKit generation UI. **Next.js 14 App Router + TypeScript + Tailwind, mobile-first (390×844), Russian interface.** Build ONLY the files below. DO NOT build API routes, `/p/[slug]`, `schemas.ts`, `validate.ts`, `price.ts`, `wa.ts`, `db.ts`, or `llm.ts` — those are owned elsewhere. Return full contents of each file and stop.

Authoritative spec: `docs/PRD.md` §4 (journey) + FR-1…FR-12; `docs/superpowers/specs/2026-07-19-satukit-design.md`; `docs/TRD.md` §5 (API contracts).

## Shared types — in `lib/schemas.ts` (import, don't redefine). Key type:
```ts
type AiOutput = { headline; description; instagram_caption; whatsapp_message; buyer_faq:{question;answer}[]; presentation_tips:string[]; confirmation_required:{claim;reason}[]; image_alt_text };
type FormInput = { product_name; facts?; region?; price?; cost?; margin_percent?; language:"ru"|"kk" };
```

## API you call (already implemented server-side — do not build):
- `POST /api/generate` → in `{ imageBase64, form: FormInput }` → out `{ id, editToken, imageUrl, output: AiOutput, issues: string[] }`; errors 422/502/504 (on failure preserve form state, offer retry + example).
- `PATCH /api/products/[id]` → `{ editToken, fields?: {headline?,description?,instagram_caption?,whatsapp_message?,price_minor?}, confirmedClaims?: string[] }`.
- `POST /api/products/[id]/publish` → `{ editToken, whatsapp, confirmAccurate: true }` → `{ slug, url }` (idempotent).
- `POST /api/feedback` → FR-10 fields incl. `product_id`.
- `POST /api/events` → `{ session_id, product_id?, event_name, metadata? }` fire-and-forget; event_name ∈ generation_requested|generation_succeeded|generation_failed|card_published|whatsapp_clicked|feedback_submitted.

## Deliver

### `lib/resize.ts` (client)
`export async function resizeImage(file: File): Promise<string>` — canvas downscale to ≤1568 px long side, JPEG quality 0.8, return a `data:image/jpeg;base64,…` dataURL. Accept JPEG/PNG/WebP/HEIC; throw a typed error on unsupported.

### `lib/example.ts`
Bundled verified example so the app demos even if the AI is down: `export const EXAMPLE_OUTPUT: AiOutput` (a realistic RU home-confectioner example), `export const EXAMPLE_IMAGE = "/example.jpg"`, `export const EXAMPLE_CARD_SLUG = "example"`.

### `app/page.tsx` (`"use client"`)
Full flow (PRD §4), one column, big tap targets, minimal text, warm/clean, no AI-slop, Russian throughout:
1. **Landing hero:** «Фото товара → продающий пост и страница за 90 секунд. Бесплатно.» + primary CTA «Создать продающий пост» + secondary «Посмотреть пример» (renders `EXAMPLE_OUTPUT` + link to `/p/example`, clearly labeled «Пример»).
2. **Upload:** `resizeImage`, local preview, replaceable, specific error on unsupported file; form state survives failures.
3. **Form:** `product_name` required; optional `facts` (что это, из чего, для кого), `price`, `cost`+`margin_percent`, `region`, `language` (ru default / kk). No channel picker.
4. **Generate:** POST `/api/generate`; persist `{id, editToken}` (editToken in `localStorage`, never in URL); fire `generation_requested` then `generation_succeeded`/`generation_failed`.
5. **Result:** show headline, description, instagram_caption, whatsapp_message, buyer_faq (3–5), presentation_tips (≤3); render `confirmation_required` as UNCHECKED checkboxes (unconfirmed claims must be excluded from publish); if `cost` was given, show price floor labeled «минимальная цена от себестоимости» (formula `cost/(1-margin/100)`, round up to tenge — inline compute is fine). Inline-edit headline/description/both channel texts/price → PATCH. «Ещё вариант» = full regenerate. One-tap copy for IG caption + WA message with visual confirmation (fire `whatsapp_clicked` on WA copy/open).
6. **Publish:** input WhatsApp number + checkbox «данные верны, опубликовать» → POST publish → show permanent link + copy button; fire `card_published`.
7. **Feedback (60-sec):** business type · region · currently selling (y/n) · ease 1–5 · usefulness 1–5 · most useful · improvement · did/will use (y/n) · consent → POST `/api/feedback`; fire `feedback_submitted`.

Error states (PRD §7): provider failure/timeout → preserve input, offer retry + example mode; oversized/unsupported file → specific message. Accessibility: labeled inputs, visible focus, WCAG AA contrast, errors tied to fields, no horizontal scroll at 390px. Generate a stable anonymous `session_id` (uuid in localStorage) for events.

## Constraints
Return `lib/resize.ts`, `lib/example.ts`, `app/page.tsx` (full contents). Assume Tailwind v4 is configured. Do not add heavy deps (uuid via `crypto.randomUUID()`). Do not touch server files.
