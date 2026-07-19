import { describe, it, expect } from "vitest";
import { validateCard } from "./validate";
import type { Card } from "./types";

const good: Card = {
  headline: "Тёплый плед, в который хочется завернуться с чаем",
  description:
    "Ручная вязка из мягкой пряжи — согреет в холодный вечер и станет уютным подарком. Напишите в директ, свяжу под ваш цвет.",
  priceHint: "12 000 ₸",
  hashtags: ["#вязаниеалматы", "#плед", "#хендмейд", "#подарок", "#уют"],
  instagramText: "Тёплый плед ручной вязки. Заказать — напишите в директ 💬",
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
    expect(
      validateCard({ ...good, instagramText: "Просто плед.", whatsappText: "Плед есть." }),
    ).toContain("no_cta");
  });
  it("flags too few hashtags", () => {
    expect(validateCard({ ...good, hashtags: ["#a"] })).toContain("few_hashtags");
  });
  it("flags empty headline", () => {
    expect(validateCard({ ...good, headline: "" })).toContain("no_headline");
  });
});
