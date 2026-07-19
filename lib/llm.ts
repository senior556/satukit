import { GoogleGenAI } from "@google/genai";
import { AiOutputSchema, type AiOutput, type FormInput } from "./schemas";

const MODEL = process.env.AI_MODEL || "gemini-2.5-flash";
let _ai: GoogleGenAI | null = null;
function ai() {
  if (!_ai) _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return _ai;
}

const SYSTEM = `Ты — сильный продающий копирайтер для женщин-микропредпринимательниц Казахстана.
Пиши живо, по-человечески, без канцелярита и штампов вроде "в современном мире". Продавай через
выгоду покупателя, а не через сухой список характеристик. Первая строка (headline) — цепляющий хук.
В instagram_caption и whatsapp_message в конце — призыв написать в директ / WhatsApp.

ПРАВДА ВАЖНЕЕ КРАСОТЫ. Используй ТОЛЬКО факты, которые дал продавец, и то, что видно на фото.
НИКОГДА не утверждай без данных продавца: сертификаты, состав/ингредиенты, происхождение,
наличие/остатки, условия доставки, лечебные/медицинские эффекты, скидки, гарантии. Любое такое
утверждение, которое хочется добавить, но продавец его НЕ дал — выноси в confirmation_required
(с полем reason), НЕ вставляй в тексты.

Язык ответа — строго запрошенный (ru или kk). Имена/бренды продавца сохраняй дословно.

Верни СТРОГО валидный JSON по схеме:
{"headline": string, "description": string, "instagram_caption": string, "whatsapp_message": string,
 "buyer_faq": [{"question": string, "answer": string}] (3–5 штук),
 "presentation_tips": [string] (до 3, только по тому что видно на фото),
 "confirmation_required": [{"claim": string, "reason": string}],
 "image_alt_text": string}`;

export async function generateKit(
  imageBase64: string,
  form: FormInput,
  repairHint?: string,
): Promise<AiOutput> {
  const m = imageBase64.match(/^data:(image\/\w+);base64,(.*)$/);
  const mimeType = m?.[1] ?? "image/jpeg";
  const data = m?.[2] ?? imageBase64;

  const facts = [
    `Название: ${form.product_name}`,
    form.facts ? `Факты от продавца: ${form.facts}` : "",
    form.price ? `Цена: ${form.price} ₸` : "",
    form.region ? `Город/регион: ${form.region}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const userText = `${facts}\n${
    repairHint ? "ОБЯЗАТЕЛЬНО ИСПРАВЬ: " + repairHint + "\n" : ""
  }Язык ответа: ${form.language === "kk" ? "казахский" : "русский"}. Верни только JSON.`;

  const response = await ai().models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [{ inlineData: { mimeType, data } }, { text: userText }],
      },
    ],
    config: { systemInstruction: SYSTEM, responseMimeType: "application/json" },
  });

  const raw = response.text ?? "{}";
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  return AiOutputSchema.parse(JSON.parse(json));
}

export const AI_MODEL_NAME = MODEL;
