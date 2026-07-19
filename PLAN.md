# Витрина — Implementation Plan (Hackathon «Startup Platform для партнёра»)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **TDD-light note:** This is a timeboxed (~one night) hackathon. Only the pure validation logic (Task 3) is unit-tested. Everything else is verified live in the browser. The real acceptance test = working demo + 5 real users.

**Goal:** Ship a live web app where a woman micro-entrepreneur uploads a product photo and gets a ready-to-post selling card (RU) in ~30 seconds, deploy it publicly, get 5+ real users to test it, and submit all 4 hackathon deliverables before 20.07 09:00.

**Architecture:** Next.js (App Router) single-page flow → API route calls Claude (vision) → returns a structured selling card as JSON → a server-side validation layer checks/repairs the card (the "not just an LLM wrapper" differentiator) → UI shows card with copy/regenerate. Deployed on Vercel for an always-on public URL.

**Tech Stack:** Next.js 14 + TypeScript + Tailwind CSS · `@anthropic-ai/sdk` (model `claude-sonnet-5`, vision) · Vercel (deploy) · Vitest (one unit test).

## Global Constraints

- **Partner:** EmpoWomen (Apec Training Centre & Asmar) — women entrepreneurs. Every product decision serves *a woman selling her own goods online*.
- **Deadline:** 20.07 09:00 Almaty. Hard. Submit by 08:00, not 08:58.
- **Public link must stay live until 24.07** without the author present.
- **Code written during the hackathon only.** Fresh repo, commit history across the sprint. No reused prior repos.
- **Language of product output:** Russian (KZ toggle is stretch, not core).
- **Prerequisite secret:** `ANTHROPIC_API_KEY` must exist (local `.env.local` + Vercel env var). If absent → BLOCKER, get a key before Task 2.
- **Model id:** `claude-sonnet-5`. Do not hardcode a different id.
- **Deliverables to win (all 4 mandatory — missing one = not reviewed):** (1) live link, (2) public GitHub repo w/ history, (3) 2–3 min demo video, (4) proof doc of 5+ user feedback.

## File Structure

```
vitrina/
  app/
    page.tsx              # the one-screen flow: upload → generate → card
    layout.tsx            # root layout, fonts, metadata
    globals.css           # tailwind
    api/generate/route.ts # POST: {imageBase64, note, lang} -> {card}
  lib/
    anthropic.ts          # Claude client + generateCard() (prompt + call + parse)
    validate.ts           # validateCard() pure logic + repair instructions
    types.ts              # Card type shared client/server
  lib/validate.test.ts    # the ONE unit test
  distribution/
    dm-script.md          # cold DM + group-post copy + target list
    feedback-form.md      # the 5-user proof template
  README.md
  .env.local              # ANTHROPIC_API_KEY (gitignored)
```

`page.tsx` owns UI state only. `api/generate/route.ts` owns the request/response. `lib/anthropic.ts` owns the prompt + Claude call + JSON parse. `lib/validate.ts` owns pure validation (testable, no network). Split by responsibility so each file is small and holdable in context.

---

### Task 1: Scaffold + deploy an empty app to Vercel FIRST (de-risk deploy early)

**Why first:** deploy is the #1 silent killer. Get a green public URL before writing features, so the last hour isn't a deploy fight.

**Files:**
- Create: whole Next.js scaffold, `README.md` stub.

- [ ] **Step 1: Scaffold**

```bash
cd /Users/artemyvoznyuk/claude
npx create-next-app@latest vitrina --typescript --tailwind --app --eslint --no-src-dir --import-alias "@/*"
cd vitrina
```

- [ ] **Step 2: Replace `app/page.tsx` with a placeholder**

```tsx
export default function Home() {
  return (
    <main className="min-h-screen grid place-items-center p-8 text-center">
      <div>
        <h1 className="text-4xl font-bold">Витрина</h1>
        <p className="mt-3 text-lg text-gray-600">Продающий пост из фото товара за 30 секунд.</p>
        <p className="mt-1 text-sm text-gray-400">Скоро здесь появится загрузка.</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Init git + first commit**

```bash
git init && git add -A && git commit -m "chore: scaffold Витрина (Next.js + Tailwind)"
```

- [ ] **Step 4: Create public GitHub repo and push**

```bash
gh repo create vitrina --public --source=. --push
```

- [ ] **Step 5: Deploy to Vercel**

```bash
npx vercel --yes            # link + deploy, follow prompts (accept defaults)
```
Expected: a live `https://vitrina-*.vercel.app` URL that shows the placeholder. **Open it in a browser and confirm it renders.** Save the URL into README.

- [ ] **Step 6: Commit README with the live URL**

```bash
git add README.md && git commit -m "docs: add live URL" && git push
```

**Deliverable:** green public URL + public repo. Deploy risk killed.

---

### Task 2: Claude generation — `lib/types.ts`, `lib/anthropic.ts`, `app/api/generate/route.ts`

**Files:**
- Create: `lib/types.ts`, `lib/anthropic.ts`, `app/api/generate/route.ts`
- Create: `.env.local` with `ANTHROPIC_API_KEY=...` (also add to Vercel later)

**Interfaces:**
- Produces: `type Card` (used by Task 3, 4). `generateCard(imageBase64: string, note: string, lang: "ru"|"kz"): Promise<Card>`.

- [ ] **Step 1: Install SDK**

```bash
npm i @anthropic-ai/sdk
```

- [ ] **Step 2: `lib/types.ts`**

```ts
export type Card = {
  headline: string;        // цепляющая первая строка (hook)
  description: string;     // продающее описание через выгоды
  priceHint: string;       // подсказка по цене / как назначить
  hashtags: string[];      // 5–10 релевантных
  instagramText: string;   // готовый пост целиком
  whatsappText: string;    // короткий вариант для рассылки
};
```

- [ ] **Step 3: `lib/anthropic.ts` — prompt + call + parse**

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { Card } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM = `Ты — сильный продающий копирайтер для женщин-предпринимательниц из Казахстана,
которые продают свои товары в Instagram и WhatsApp. По фото товара и короткой заметке напиши
продающий пост на русском. Пиши живо, по-человечески, без канцелярита и штампов вроде
"в современном мире". Продавай через выгоду для покупателя, а не через список характеристик.
Первая строка — цепляющий хук. В конце — призыв к действию (написать в директ/заказать).
Верни СТРОГО валидный JSON без markdown-обёртки по схеме:
{"headline": string, "description": string, "priceHint": string, "hashtags": string[],
"instagramText": string, "whatsappText": string}`;

export async function generateCard(imageBase64: string, note: string, lang: "ru" | "kz", repairHint?: string): Promise<Card> {
  const media = imageBase64.match(/^data:(image\/\w+);base64,(.*)$/);
  const mediaType = (media?.[1] ?? "image/jpeg") as "image/jpeg" | "image/png" | "image/webp";
  const data = media?.[2] ?? imageBase64;

  const msg = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1200,
    system: SYSTEM,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data } },
        { type: "text", text: `Заметка продавца: ${note || "(нет)"}\n${repairHint ? "ИСПРАВЬ: " + repairHint : ""}\nЯзык: русский. Верни только JSON.` },
      ],
    }],
  });

  const text = msg.content.find((b) => b.type === "text");
  const raw = text && "text" in text ? text.text : "{}";
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  return JSON.parse(json) as Card;
}
```

- [ ] **Step 4: `app/api/generate/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { generateCard } from "@/lib/anthropic";
import { validateCard, buildRepairHint } from "@/lib/validate";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, note, lang } = await req.json();
    if (!imageBase64) return NextResponse.json({ error: "no image" }, { status: 400 });

    let card = await generateCard(imageBase64, note ?? "", lang ?? "ru");
    let issues = validateCard(card);
    if (issues.length) {
      card = await generateCard(imageBase64, note ?? "", lang ?? "ru", buildRepairHint(issues));
      issues = validateCard(card);
    }
    return NextResponse.json({ card, issues });
  } catch (e) {
    return NextResponse.json({ error: "generation failed" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Verify locally**

```bash
npm run dev
```
Then in a second terminal POST a small base64 image; expect `{card: {...}}`. (Full manual check happens in Task 4 via the UI.)

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: Claude generation API + card type"
```

---

### Task 3: Validation layer + repair — `lib/validate.ts` (+ the one unit test)

**This is the differentiator: proves it's not a thin wrapper.**

**Files:**
- Create: `lib/validate.ts`, `lib/validate.test.ts`

**Interfaces:**
- Produces: `validateCard(card: Card): string[]` (list of issue codes), `buildRepairHint(issues: string[]): string`. Consumed by Task 2's route.

- [ ] **Step 1: Install Vitest**

```bash
npm i -D vitest
```
Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 2: Write the failing test — `lib/validate.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { validateCard } from "./validate";
import type { Card } from "./types";

const good: Card = {
  headline: "Тёплый плед, в который хочется завернуться с чаем",
  description: "Ручная вязка из мягкой пряжи — согреет в холодный вечер и станет уютным подарком. Напишите в директ, свяжу под ваш цвет.",
  priceHint: "12 000 ₸",
  hashtags: ["#вязаниеалматы", "#плед", "#хендмейд", "#подарок", "#уют"],
  instagramText: "Тёплый плед... Заказать — в директ 💬",
  whatsappText: "Здравствуйте! Есть плед ручной вязки, 12 000 ₸. Показать цвета?",
};

describe("validateCard", () => {
  it("passes a good card", () => {
    expect(validateCard(good)).toEqual([]);
  });
  it("flags missing price", () => {
    expect(validateCard({ ...good, priceHint: "" })).toContain("no_price");
  });
  it("flags missing CTA", () => {
    expect(validateCard({ ...good, instagramText: "Просто плед." })).toContain("no_cta");
  });
  it("flags too few hashtags", () => {
    expect(validateCard({ ...good, hashtags: ["#a"] })).toContain("few_hashtags");
  });
  it("flags empty headline", () => {
    expect(validateCard({ ...good, headline: "" })).toContain("no_headline");
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

```bash
npm test
```
Expected: FAIL ("validateCard is not a function").

- [ ] **Step 4: Implement `lib/validate.ts`**

```ts
import type { Card } from "./types";

const CTA = /(директ|напиши|заказ|whatsapp|ватсап|пишите|звони|бронир|оформ)/i;

export function validateCard(c: Card): string[] {
  const issues: string[] = [];
  if (!c.headline?.trim()) issues.push("no_headline");
  if (!c.description || c.description.trim().length < 40) issues.push("short_description");
  if (!c.priceHint?.trim()) issues.push("no_price");
  if (!Array.isArray(c.hashtags) || c.hashtags.length < 3) issues.push("few_hashtags");
  const body = `${c.instagramText} ${c.whatsappText}`;
  if (!CTA.test(body)) issues.push("no_cta");
  return issues;
}

const HINTS: Record<string, string> = {
  no_headline: "добавь цепляющий заголовок-хук первой строкой",
  short_description: "сделай описание длиннее и через выгоды для покупателя",
  no_price: "добавь подсказку по цене (в тенге)",
  few_hashtags: "дай 5–10 релевантных хэштегов",
  no_cta: "добавь явный призыв: написать в директ / заказать в WhatsApp",
};

export function buildRepairHint(issues: string[]): string {
  return issues.map((i) => HINTS[i]).filter(Boolean).join("; ");
}
```

- [ ] **Step 5: Run — expect PASS**

```bash
npm test
```
Expected: 5 passing.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: card validation + repair layer (tested)"
```

---

### Task 4: The one-screen UI flow — `app/page.tsx`

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Implement upload → generate → card**

```tsx
"use client";
import { useState } from "react";
import type { Card } from "@/lib/types";

export default function Home() {
  const [preview, setPreview] = useState<string>("");
  const [imageBase64, setImageBase64] = useState<string>("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState("");

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { const d = r.result as string; setImageBase64(d); setPreview(d); };
    r.readAsDataURL(f);
  }

  async function generate() {
    setLoading(true); setError(""); setCard(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, note, lang: "ru" }),
      });
      const data = await res.json();
      if (data.card) setCard(data.card); else setError("Не получилось, попробуйте другое фото");
    } catch { setError("Ошибка сети, попробуйте ещё раз"); }
    finally { setLoading(false); }
  }

  const copy = (t: string) => navigator.clipboard.writeText(t);

  return (
    <main className="min-h-screen max-w-xl mx-auto p-6">
      <h1 className="text-3xl font-bold">Витрина</h1>
      <p className="text-gray-600 mt-1">Загрузи фото товара — получи готовый продающий пост за 30 секунд. Бесплатно.</p>

      <label className="mt-6 block border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:bg-gray-50">
        {preview ? <img src={preview} alt="" className="max-h-56 mx-auto rounded-lg" /> : <span className="text-gray-500">📷 Нажми и выбери фото товара</span>}
        <input type="file" accept="image/*" className="hidden" onChange={onFile} />
      </label>

      <input value={note} onChange={(e) => setNote(e.target.value)}
        placeholder="Пара слов: что это и для кого (необязательно)"
        className="mt-3 w-full border rounded-lg p-3" />

      <button onClick={generate} disabled={!imageBase64 || loading}
        className="mt-4 w-full bg-black text-white rounded-lg p-3 font-medium disabled:opacity-40">
        {loading ? "Генерирую…" : "Сделать продающий пост"}
      </button>

      {error && <p className="mt-3 text-red-600">{error}</p>}

      {card && (
        <div className="mt-6 space-y-4">
          <Block title="Готовый пост для Instagram" text={card.instagramText} onCopy={copy} />
          <Block title="Короткий текст для WhatsApp" text={card.whatsappText} onCopy={copy} />
          <Block title="Хэштеги" text={card.hashtags.join(" ")} onCopy={copy} />
          <p className="text-sm text-gray-500">💡 Цена: {card.priceHint}</p>
          <button onClick={generate} className="w-full border rounded-lg p-3">🔄 Ещё вариант</button>
        </div>
      )}
    </main>
  );
}

function Block({ title, text, onCopy }: { title: string; text: string; onCopy: (t: string) => void }) {
  return (
    <div className="border rounded-xl p-4">
      <div className="flex justify-between items-center">
        <span className="font-medium">{title}</span>
        <button onClick={() => onCopy(text)} className="text-sm bg-gray-100 px-3 py-1 rounded">Скопировать</button>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-gray-800">{text}</p>
    </div>
  );
}
```

- [ ] **Step 2: Verify live in browser**

```bash
npm run dev
```
Open http://localhost:3000 → upload a real product photo → click generate → a full card appears → copy works → "ещё вариант" regenerates. Fix until the core loop is smooth end-to-end.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: upload → generate → card UI"
```

---

### Task 5: Ship + harden (env, errors, mobile, deploy the real thing)

**Files:** minor edits across UI/route.

- [ ] **Step 1: Add API key to Vercel + redeploy**

```bash
npx vercel env add ANTHROPIC_API_KEY production   # paste key
npx vercel --prod
```

- [ ] **Step 2: Mobile check** — open the prod URL on a phone (or DevTools mobile). The audience is on phones. Confirm upload + generate + copy work on mobile. Fix layout if broken.

- [ ] **Step 3: Error paths** — test: no image (button disabled), huge image (add client resize if it fails), Claude returns junk (route already retries once, then shows friendly error). No crashes on base actions.

- [ ] **Step 4: Commit + redeploy**

```bash
git add -A && git commit -m "feat: prod hardening (env, mobile, errors)" && git push && npx vercel --prod
```

**Deliverable:** the real product live at a public URL, works from a stranger's phone. (40% criterion secured.)

---

### Task 6 (STRETCH — only if ahead of schedule): pick ONE

Skip unless core is done and stable. In priority order:
1. **Downloadable image card** (photo + caption overlay via `html-to-image`) — shareable, great for demo.
2. **KZ language toggle** — passes `lang: "kz"`; boosts partner relevance (rural/Kazakh audience).
3. **Per-card share link** (Vercel KV + `/card/[id]`).

Do NOT start two. Commit each separately.

---

### Task 7: Distribution assets — `distribution/dm-script.md`, `distribution/feedback-form.md`

**Prepare these while the app builds — start outreach the moment the URL is live.**

- [ ] **Step 1: `distribution/dm-script.md`** — write:
  - **Target list (aim 40–60):** KZ Instagram sellers (search #хендмейдказахстан #рукоделиеалматы #тортыналматы #мылоручнойработы and "мама предприниматель"), and 3–4 Telegram/FB groups (женский бизнес, хендмейд Казахстан, мамы Алматы, ярмарки мастеров).
  - **Cold DM (gift framing, RU):** "Здравствуйте! Я сделал бесплатный инструмент: загружаете фото товара — он за 30 секунд пишет продающий пост для Instagram/WhatsApp. Дарю, ничего не прошу взамен — только скажете, полезно или нет. Вот ссылка: <URL>. Можно спросить, что бы улучшили?"
  - **Group post:** a short value-first post with the link + one screenshot of a generated card.
- [ ] **Step 2: `distribution/feedback-form.md`** — proof template, one row per user: роль/сфера (без ПД) · как и когда тестил · что сказал · пруф (скрин/аудио) · **что я изменил после**.
- [ ] **Step 3: Commit** `git add -A && git commit -m "docs: distribution + feedback assets"`

---

### Task 8: Run distribution → collect 5+ → iterate (the 20% + the story)

- [ ] **Step 1: Post in 2–3 groups + send 30–50 DMs** (spread out to avoid IG spam flags; personalize first line).
- [ ] **Step 2: As people try it, capture screenshots + their exact words.** Ask one question: "что бы улучшили?"
- [ ] **Step 3: Make 2–3 real changes from feedback** (e.g., add price-in-tenge default, shorten WhatsApp text, add KZ, fix a confusing button). Commit each: `git commit -m "feat: <change> from user feedback"`.
- [ ] **Step 4: Fill `feedback-form.md` with 5–8 real users** incl. what changed. Target 5 minimum, aim 8.

**Gate:** if fewer than 5 by ~06:00, escalate — post in more groups, ask early testers to forward. This is the mandatory deliverable; do not stop at 3.

---

### Task 9: Demo video + README + submit

- [ ] **Step 1: Record 2–3 min demo** (Loom/screen). Structure: (1) проблема — женщины-микробизнес теряют продажи, не умеют писать посты; (2) решение — Витрина; (3) **вживую**: реальное фото → карточка генерится → copy; (4) реальный фидбэк юзера + что изменил. No slides. Under 3:00.
- [ ] **Step 2: Finalize `README.md`** — partner (EmpoWomen), problem, solution, stack, **run instructions** (`npm i` → `.env.local` with ANTHROPIC_API_KEY → `npm run dev`), live URL, link to demo video. Confirm commit history reflects the sprint.
- [ ] **Step 3: Final check from a clean device/incognito** — the live URL opens and works with no login/VPN. Video link public. Feedback doc public/accessible.
- [ ] **Step 4: Submit via the form** (published 19.07 09:00). Submit by **08:00**, keep the app live until **24.07**.

---

## Self-Review

- **Spec coverage:** product (T1–T6) ✓ · partner relevance (Global Constraints + copy targets women sellers) ✓ · distribution & feedback (T7–T8) ✓ · pitch/demo (T9) ✓ · all 4 deliverables (T1 link, T1 repo, T9 video, T8 proof) ✓.
- **Placeholder scan:** no TBD/TODO in code steps; all code shown. Stretch tasks intentionally optional and labeled.
- **Type consistency:** `Card` defined in T2, used identically in T3/T4; `validateCard`/`buildRepairHint` signatures match between `validate.ts` and the route. `generateCard` signature (with optional `repairHint`) matches its call sites.
- **Biggest risk = distribution (T8).** Mitigated by deploying first (T1), a 30-second-value product, gift-framed outreach, and an escalation gate.

## Execution order & rough timebox (from URL-live)
T1 deploy (0:00–0:45) → T2–T4 core (0:45–3:30) → T5 ship (3:30–4:15) → **T7 assets prepared in parallel from ~1:00; T8 outreach starts the moment prod URL is live (~4:15)** → T8 collect/iterate (4:15–7:00) → T9 demo+README+submit (7:00–8:00) → reserve to 09:00.
