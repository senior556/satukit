import Link from "next/link";
import { getPublicBySlug } from "@/lib/db";
import { filterPublicPayload } from "@/lib/validate";
import { waLink } from "@/lib/wa";
import { CURRENCY_SYMBOL } from "@/lib/money";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

export default async function CardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const row = await getPublicBySlug(slug);

  if (!row) {
    return (
      <main className="min-h-screen grid place-items-center p-8 text-center">
        <div>
          <h1 className="text-2xl font-bold">Страница не найдена</h1>
          <p className="mt-2 text-gray-600">Возможно, карточка ещё не опубликована.</p>
          <Link href="/" className="mt-4 inline-block text-black underline">
            Создать свою в SatuKit
          </Link>
        </div>
      </main>
    );
  }

  const card = filterPublicPayload(row);
  const price = card.price_minor != null ? Math.round(card.price_minor / 100) : null;
  const msg = `Здравствуйте! Пишу по объявлению «${card.product_name}».`;
  const wa = card.whatsapp_e164 ? waLink(card.whatsapp_e164, msg) : null;

  const base = process.env.APP_BASE_URL || "https://vitrina-drab-one.vercel.app";
  const qrDataUrl = await QRCode.toDataURL(`${base}/p/${slug}`, {
    width: 480,
    margin: 1,
    color: { dark: "#201b17", light: "#ffffff" },
  });

  return (
    <main className="min-h-screen max-w-md mx-auto p-4 pb-24">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={card.image_url}
        alt={card.product_name}
        className="w-full aspect-square object-cover rounded-2xl"
      />
      <h1 className="mt-4 text-2xl font-bold">{card.product_name}</h1>
      {price != null && (
        <p className="mt-1 text-xl font-semibold">
          {price.toLocaleString("ru-RU")} {CURRENCY_SYMBOL[card.currency]}
        </p>
      )}
      {card.region && <p className="mt-1 text-sm text-gray-500">{card.region}</p>}
      <p className="mt-4 whitespace-pre-wrap text-gray-800 leading-relaxed">{card.description}</p>

      <section className="mt-8 rounded-2xl border border-black/10 bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
          QR для прилавка и ярмарки
        </p>
        <div className="mt-3 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt={`QR-код карточки «${card.product_name}»`}
            className="size-28 shrink-0 rounded-lg border border-black/10"
          />
          <div className="text-sm leading-6 text-gray-500">
            <p>Распечатайте и поставьте рядом с товаром — покупатель сканирует и сразу пишет вам в WhatsApp.</p>
            <a
              href={qrDataUrl}
              download={`satukit-qr-${slug}.png`}
              className="mt-1 inline-block font-semibold text-gray-700 underline"
            >
              Скачать QR
            </a>
          </div>
        </div>
      </section>

      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md text-center bg-[#25D366] text-white font-semibold rounded-xl p-4 shadow-lg"
        >
          Написать в WhatsApp
        </a>
      )}

      <footer className="mt-10 text-center">
        <Link href="/" className="text-xs text-gray-400">
          Создано в SatuKit
        </Link>
      </footer>
    </main>
  );
}
