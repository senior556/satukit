import Link from "next/link";
import { getPublicBySlug } from "@/lib/db";
import { filterPublicPayload } from "@/lib/validate";
import { waLink } from "@/lib/wa";
import { CURRENCY_SYMBOL } from "@/lib/money";

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
