import { describe, it, expect } from "vitest";
import type { AiOutput, FormInput } from "../schemas";
import { validateOutput, buildRepairHint, filterPublicPayload, describeIssuesRu } from "../validate";
import { priceFloorMinor } from "../price";
import { toE164, waLink } from "../wa";

// ---- Good fixtures (valid output, no prohibited claims) ------------------
const goodForm: FormInput = {
  product_name: "Горный мёд",
  facts: "Баночка 0.5 кг, собран летом",
  language: "ru",
};

const goodOutput: AiOutput = {
  headline: "Горный мёд с пасеки",
  description: "Ароматный мёд с насыщенным вкусом. Баночка удобного размера.",
  instagram_caption: "Попробуйте наш мёд — вкус, который запоминается!",
  whatsapp_message: "Здравствуйте! Пишите по вопросам покупки, ответим быстро.",
  buyer_faq: [
    { question: "Какой объём?", answer: "0.5 кг" },
    { question: "Как хранить?", answer: "В сухом прохладном месте" },
    { question: "Как заказать?", answer: "Напишите нам в WhatsApp" },
  ],
  presentation_tips: ["Снимите баночку при дневном свете"],
  confirmation_required: [],
  image_alt_text: "Стеклянная баночка мёда",
};

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

describe("validateOutput", () => {
  it("passes a good fixture", () => {
    expect(validateOutput(goodOutput, goodForm)).toEqual([]);
  });

  it("flags faq_count when buyer_faq is out of the 3–5 range", () => {
    const o = clone(goodOutput);
    o.buyer_faq = [{ question: "q", answer: "a" }, { question: "q2", answer: "a2" }];
    expect(validateOutput(o, goodForm)).toContain("faq_count");

    const o2 = clone(goodOutput);
    o2.buyer_faq = Array.from({ length: 6 }, (_, i) => ({ question: `q${i}`, answer: `a${i}` }));
    expect(validateOutput(o2, goodForm)).toContain("faq_count");
  });

  it("flags tips_count when presentation_tips exceeds 3", () => {
    const o = clone(goodOutput);
    o.presentation_tips = ["a", "b", "c", "d"];
    expect(validateOutput(o, goodForm)).toContain("tips_count");
  });

  it("flags lang_kk when kk output has no Kazakh letters", () => {
    const kkForm: FormInput = { ...goodForm, language: "kk" };
    // goodOutput is pure Russian/Cyrillic without Kazakh-specific letters.
    expect(validateOutput(goodOutput, kkForm)).toContain("lang_kk");
  });

  it("does not flag lang_kk when Kazakh letters are present", () => {
    const kkForm: FormInput = { ...goodForm, language: "kk" };
    const o = clone(goodOutput);
    o.description = "Тау балы — дәмі керемет өнім.";
    expect(validateOutput(o, kkForm)).not.toContain("lang_kk");
  });

  it("flags ig_len when instagram_caption exceeds 2200 chars", () => {
    const o = clone(goodOutput);
    o.instagram_caption = "a".repeat(2201);
    expect(validateOutput(o, goodForm)).toContain("ig_len");
  });

  it("flags wa_len when whatsapp_message exceeds 700 chars", () => {
    const o = clone(goodOutput);
    o.whatsapp_message = "b".repeat(701);
    expect(validateOutput(o, goodForm)).toContain("wa_len");
  });

  it("flags a prohibited category when claimed but not in facts", () => {
    const o = clone(goodOutput);
    o.description = "Быстрая доставка по всему городу за час.";
    const issues = validateOutput(o, goodForm); // facts has no delivery mention
    expect(issues).toContain("prohibited:delivery");
  });

  it("does not flag a prohibited category when the seller supplied it in facts", () => {
    const o = clone(goodOutput);
    o.description = "Быстрая доставка по всему городу за час.";
    const form: FormInput = { ...goodForm, facts: "Есть доставка по городу" };
    expect(validateOutput(o, form)).not.toContain("prohibited:delivery");
  });
});

describe("buildRepairHint", () => {
  it("returns a non-empty string for each known code", () => {
    for (const code of ["faq_count", "tips_count", "lang_kk", "ig_len", "wa_len"]) {
      expect(buildRepairHint([code]).length).toBeGreaterThan(0);
    }
    expect(buildRepairHint(["prohibited:delivery"]).length).toBeGreaterThan(0);
  });

  it("joins multiple hints", () => {
    const hint = buildRepairHint(["faq_count", "prohibited:delivery"]);
    expect(hint).toContain(";");
  });

  it("returns empty string for no issues", () => {
    expect(buildRepairHint([])).toBe("");
  });
});

describe("priceFloorMinor", () => {
  it("applies the formula and rounds up to whole tenge", () => {
    // 10000 / (1 - 0.30) = 14285.71 -> round up to 14300
    expect(priceFloorMinor(10000, 30)).toBe(14300);
    // 10000 / (1 - 0.20) = 12500 -> exact, stays 12500
    expect(priceFloorMinor(10000, 20)).toBe(12500);
  });

  it("returns null when cost <= 0", () => {
    expect(priceFloorMinor(0, 20)).toBeNull();
    expect(priceFloorMinor(-100, 20)).toBeNull();
  });

  it("returns null when margin is out of (0, 95) bounds", () => {
    expect(priceFloorMinor(10000, 0)).toBeNull();
    expect(priceFloorMinor(10000, 95)).toBeNull();
    expect(priceFloorMinor(10000, 120)).toBeNull();
  });
});

describe("toE164", () => {
  it("normalizes +7 numbers", () => {
    expect(toE164("+77001234567")).toBe("+77001234567");
  });

  it("normalizes 8-prefixed numbers", () => {
    expect(toE164("87001234567")).toBe("+77001234567");
  });

  it("normalizes numbers with spaces", () => {
    expect(toE164("+7 700 123 45 67")).toBe("+77001234567");
  });

  it("normalizes numbers with dashes and parentheses", () => {
    expect(toE164("8 (700) 123-45-67")).toBe("+77001234567");
  });

  it("returns null for invalid numbers", () => {
    expect(toE164("12345")).toBeNull();
    expect(toE164("")).toBeNull();
    expect(toE164("+1 202 555 0123")).toBeNull(); // wrong country / not KZ
  });
});

describe("waLink", () => {
  it("builds a wa.me link without the plus and encodes the message", () => {
    const link = waLink("+77001234567", "Привет, есть в наличии?");
    expect(link).toBe(
      `https://wa.me/77001234567?text=${encodeURIComponent("Привет, есть в наличии?")}`,
    );
    expect(link).not.toContain("+7");
  });
});

describe("filterPublicPayload", () => {
  it("returns only public fields and never leaks cost/margin/edit_token", () => {
    const row = {
      product_name: "Горный мёд",
      generated_output: { ...goodOutput, description: "Отредактированное описание" },
      price_minor: 15000,
      region: "Алматы",
      image_url: "https://example.com/honey.jpg",
      whatsapp_e164: "+77001234567",
      language: "ru" as const,
      // sensitive fields that must never appear in output:
      cost: 9000,
      margin_percent: 40,
      edit_token: "secret-token",
    };

    const card = filterPublicPayload(row as never);

    expect(card).toEqual({
      product_name: "Горный мёд",
      description: "Отредактированное описание",
      price_minor: 15000,
      region: "Алматы",
      image_url: "https://example.com/honey.jpg",
      whatsapp_e164: "+77001234567",
      language: "ru",
    });

    const keys = Object.keys(card);
    expect(keys).not.toContain("cost");
    expect(keys).not.toContain("margin_percent");
    expect(keys).not.toContain("edit_token");
    expect(keys).not.toContain("confirmation_required");
  });

  it("coerces a null whatsapp_e164 to an empty string", () => {
    const row = {
      product_name: "Товар",
      generated_output: goodOutput,
      price_minor: null,
      region: null,
      image_url: "https://example.com/x.jpg",
      whatsapp_e164: null,
      language: "kk" as const,
    };
    expect(filterPublicPayload(row).whatsapp_e164).toBe("");
  });
});

describe("describeIssuesRu", () => {
  it("maps prohibited codes to human labels", () => {
    const labels = describeIssuesRu(["prohibited:delivery"]);
    expect(labels).toHaveLength(1);
    expect(labels[0]).toMatch(/доставк/i);
  });

  it("collapses empty:* codes into one label and drops unknown codes", () => {
    const labels = describeIssuesRu(["empty:headline", "empty:description", "nonsense"]);
    expect(labels).toHaveLength(1);
  });

  it("returns nothing for a clean kit", () => {
    expect(describeIssuesRu([])).toEqual([]);
  });
});
