import { GoogleGenAI } from "@google/genai";
import type { Card } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM = `Ты — сильный продающий копирайтер для женщин-предпринимательниц из Казахстана,
которые продают свои товары в Instagram и WhatsApp. По фото товара и короткой заметке напиши
продающий пост. Пиши живо, по-человечески, без канцелярита и штампов вроде "в современном мире".
Продавай через выгоду для покупателя, а не через сухой список характеристик.
Поля: headline — цепляющий хук первой строкой; description — продающее описание через выгоды;
priceHint — подсказка по цене в тенге (₸); если по фото цену не определить — предложи вилку;
hashtags — 5–10 релевантных; instagramText и whatsappText — готовые тексты, в конце ОБЯЗАТЕЛЬНО
призыв к действию (написать в директ / заказать в WhatsApp).`;

export async function generateCard(
  imageBase64: string,
  note: string,
  lang: "ru" | "kz",
  repairHint?: string,
): Promise<Card> {
  const m = imageBase64.match(/^data:(image\/\w+);base64,(.*)$/);
  const mimeType = m?.[1] ?? "image/jpeg";
  const data = m?.[2] ?? imageBase64;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data } },
          {
            text: `Заметка продавца: ${note || "(нет)"}\n${
              repairHint ? "ОБЯЗАТЕЛЬНО ИСПРАВЬ: " + repairHint + "\n" : ""
            }Язык ответа: ${lang === "kz" ? "казахский" : "русский"}.`,
          },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: "application/json",
    },
  });

  const raw = response.text ?? "{}";
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  return JSON.parse(json) as Card;
}
