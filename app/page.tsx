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
    r.onload = () => {
      const d = r.result as string;
      setImageBase64(d);
      setPreview(d);
      setCard(null);
      setError("");
    };
    r.readAsDataURL(f);
  }

  async function generate() {
    setLoading(true);
    setError("");
    setCard(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, note, lang: "ru" }),
      });
      const data = await res.json();
      if (data.card) setCard(data.card);
      else setError("Не получилось — попробуйте другое фото.");
    } catch {
      setError("Ошибка сети, попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  const copy = (t: string) => navigator.clipboard.writeText(t);

  return (
    <main className="min-h-screen max-w-xl mx-auto p-6 pb-20">
      <h1 className="text-3xl font-bold">Витрина</h1>
      <p className="text-gray-600 mt-1">
        Загрузи фото товара — получи готовый продающий пост за 30 секунд. Бесплатно.
      </p>

      <label className="mt-6 block border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:bg-gray-50 transition">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="товар" className="max-h-56 mx-auto rounded-lg" />
        ) : (
          <span className="text-gray-500">📷 Нажми и выбери фото товара</span>
        )}
        <input type="file" accept="image/*" className="hidden" onChange={onFile} />
      </label>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Пара слов: что это и для кого (необязательно)"
        className="mt-3 w-full border border-gray-300 rounded-lg p-3"
      />

      <button
        onClick={generate}
        disabled={!imageBase64 || loading}
        className="mt-4 w-full bg-black text-white rounded-lg p-3 font-medium disabled:opacity-40 transition"
      >
        {loading ? "Генерирую…" : "Сделать продающий пост"}
      </button>

      {error && <p className="mt-3 text-red-600">{error}</p>}

      {card && (
        <div className="mt-6 space-y-4">
          <Block title="Готовый пост для Instagram" text={card.instagramText} onCopy={copy} />
          <Block title="Короткий текст для WhatsApp" text={card.whatsappText} onCopy={copy} />
          <Block title="Хэштеги" text={card.hashtags.join(" ")} onCopy={copy} />
          <p className="text-sm text-gray-500">💡 Цена: {card.priceHint}</p>
          <button
            onClick={generate}
            className="w-full border border-gray-300 rounded-lg p-3 hover:bg-gray-50 transition"
          >
            🔄 Ещё вариант
          </button>
        </div>
      )}
    </main>
  );
}

function Block({
  title,
  text,
  onCopy,
}: {
  title: string;
  text: string;
  onCopy: (t: string) => void;
}) {
  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <div className="flex justify-between items-center gap-2">
        <span className="font-medium">{title}</span>
        <button
          onClick={() => onCopy(text)}
          className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded transition shrink-0"
        >
          Скопировать
        </button>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-gray-800">{text}</p>
    </div>
  );
}
