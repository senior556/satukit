import type { AiOutput } from "./schemas";

// Verified example used by "Посмотреть пример" (works even if the AI provider
// is down) and mirrored by the pre-published card at /p/example.
export const EXAMPLE_PRODUCT: {
  productName: string;
  facts: string;
  region: string;
  priceTenge: number;
  language: "ru";
  imageUrl: string;
  output: AiOutput;
} = {
  productName: "Свеча «Ванильный вечер»",
  facts:
    "Свеча ручной работы из соевого воска. Ванильный аромат, хлопковый фитиль, стеклянная банка, вес 180 г.",
  region: "Алматы",
  priceTenge: 7_500,
  language: "ru",
  imageUrl: "/example.jpg",
  output: {
    headline: "Ванильный вечер в мягком свете",
    description:
      "Свеча ручной работы из соевого воска с тёплым ванильным ароматом. Хлопковый фитиль даёт ровный огонь, а лаконичная стеклянная банка хорошо смотрится дома и подходит для небольшого подарка.",
    instagram_caption:
      "Когда хочется выключить шум дня и оставить только мягкий свет. «Ванильный вечер» — свеча ручной работы из соевого воска с хлопковым фитилём и спокойным ванильным ароматом. Вес — 180 г, цена — 7 500 ₸. Напишите в сообщения, если хотите узнать больше.",
    whatsapp_message:
      "Здравствуйте! Это свеча «Ванильный вечер» ручной работы: соевый воск, хлопковый фитиль, ванильный аромат, 180 г. Цена — 7 500 ₸. Напишите, если хотите узнать больше.",
    buyer_faq: [
      { question: "Из чего сделана свеча?", answer: "Из соевого воска с хлопковым фитилём." },
      { question: "Какой у неё аромат?", answer: "Мягкий ванильный аромат." },
      { question: "Какой вес?", answer: "180 граммов." },
    ],
    presentation_tips: [
      "Снимите свечу зажжённой в тёплом вечернем свете.",
      "Добавьте крупный план воска и хлопкового фитиля.",
      "Поставьте рядом предмет для понятного масштаба.",
    ],
    confirmation_required: [],
    image_alt_text: "Зажжённая ароматическая свеча в стеклянной банке на светлом столе",
  },
};

export const EXAMPLE_CARD_SLUG = "example";
