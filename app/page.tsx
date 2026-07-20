"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { EXAMPLE_PRODUCT } from "@/lib/example";
import { priceFloorMinor } from "@/lib/price";
import { resizeImage, type ResizedImage } from "@/lib/resize";
import type { AiOutput, CurrencyCode, Lang } from "@/lib/schemas";
import { CURRENCY_SYMBOL, formatMoney } from "@/lib/money";
import { describeIssuesRu } from "@/lib/validate";

type ViewState =
  | "landing"
  | "image-ready"
  | "generating"
  | "result"
  | "error"
  | "example";

type FormState = {
  productName: string;
  facts: string;
  costTenge: string;
  marginPercent: string;
  priceTenge: string;
  currency: CurrencyCode;
  region: string;
  language: Lang;
};

type GenerateResponse = {
  id: string;
  editToken: string;
  imageUrl: string;
  output: AiOutput;
  issues: string[];
};

type EventName =
  | "generation_requested"
  | "generation_succeeded"
  | "generation_failed"
  | "card_published"
  | "whatsapp_clicked"
  | "feedback_submitted";

const INITIAL_FORM: FormState = {
  productName: "",
  facts: "",
  costTenge: "",
  marginPercent: "",
  priceTenge: "",
  currency: "KZT",
  region: "",
  language: "ru",
};

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem("satukit_session");
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem("satukit_session", id);
    }
    return id;
  } catch {
    return "";
  }
}

// Fire-and-forget funnel event. Never throws, never blocks the UI.
function track(event_name: EventName, product_id?: string) {
  try {
    const session_id = getSessionId();
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id, product_id, event_name }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Не удалось прочитать изображение."));
    reader.readAsDataURL(blob);
  });
}

function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Что-то пошло не так. Попробуйте ещё раз.";
}

export default function Home() {
  const [view, setView] = useState<ViewState>("landing");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [image, setImage] = useState<ResizedImage | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [resizeMessage, setResizeMessage] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const previewUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const priceFloorTenge = useMemo(() => {
    const cost = Number(form.costTenge);
    const margin = Number(form.marginPercent);
    const m = priceFloorMinor(Math.round(cost * 100), margin);
    return m == null ? null : m / 100;
  }, [form.costTenge, form.marginPercent]);

  function updateForm<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleImageFile(file: File) {
    setResizeMessage("Подготавливаем фото на вашем устройстве…");
    setErrorMessage("");

    try {
      const nextImage = await resizeImage(file);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = nextImage.previewUrl;
      setImage(nextImage);
      setView("image-ready");
      setResizeMessage(
        `Фото готово: ${nextImage.width} × ${nextImage.height} px, ${(nextImage.blob.size / 1024 / 1024).toFixed(1)} МБ`,
      );
    } catch (error) {
      setErrorMessage(errorText(error));
      setView("error");
      setResizeMessage("");
    }
  }

  const handleImageFileRef = useRef(handleImageFile);
  handleImageFileRef.current = handleImageFile;

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const item = Array.from(event.clipboardData?.items ?? []).find((entry) =>
        entry.type.startsWith("image/"),
      );
      const file = item?.getAsFile();
      if (!file) return;
      event.preventDefault();
      void handleImageFileRef.current(file);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  async function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await handleImageFile(file);
  }

  async function generate(event?: FormEvent) {
    event?.preventDefault();

    if (!form.productName.trim()) {
      setErrorMessage("Введите название товара.");
      setView("error");
      return;
    }

    if (!image) {
      setErrorMessage("Добавьте фотографию товара.");
      setView("error");
      return;
    }

    setView("generating");
    setErrorMessage("");
    setCopyStatus("");
    track("generation_requested");

    try {
      const imageBase64 = await blobToBase64(image.blob);

      const cost = Number(form.costTenge);
      const margin = Number(form.marginPercent);
      const price = Number(form.priceTenge);
      const requestForm = {
        product_name: form.productName.trim(),
        facts: form.facts.trim() || undefined,
        region: form.region.trim() || undefined,
        cost:
          form.costTenge.trim() !== "" && Number.isFinite(cost) ? cost : undefined,
        margin_percent:
          form.marginPercent.trim() !== "" && Number.isFinite(margin)
            ? margin
            : undefined,
        price:
          form.priceTenge.trim() !== "" && Number.isFinite(price)
            ? Math.round(price)
            : undefined,
        currency: form.currency,
        language: form.language,
      };

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, form: requestForm }),
      });

      if (!response.ok) {
        track("generation_failed");
        throw new Error(
          "Сервис генерации пока не ответил. Ваши данные сохранены — попробуйте снова или откройте пример.",
        );
      }

      const payload = (await response.json()) as GenerateResponse;

      if (!payload.output) {
        track("generation_failed", payload.id);
        throw new Error(
          "Ответ пришёл без текста. Попробуйте ещё раз или откройте пример.",
        );
      }

      if (payload.id && payload.editToken) {
        try {
          window.localStorage.setItem(`satukit_edit_${payload.id}`, payload.editToken);
        } catch {
          // localStorage unavailable — publishing still works within this session
        }
      }

      setResult({
        id: payload.id ?? "",
        editToken: payload.editToken ?? "",
        imageUrl: payload.imageUrl || image.previewUrl,
        output: payload.output,
        issues: Array.isArray(payload.issues) ? payload.issues : [],
      });
      setView("result");
      track("generation_succeeded", payload.id);
    } catch (error) {
      setErrorMessage(errorText(error));
      setView("error");
    }
  }

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(`${label} скопирован.`);
    } catch {
      setCopyStatus("Не удалось скопировать. Выделите текст и скопируйте вручную.");
    }
  }

  function openExample() {
    setCopyStatus("");
    setView("example");
  }

  function returnToForm() {
    setCopyStatus("");
    setView(image ? "image-ready" : "landing");
  }

  const enteredPrice = Number(form.priceTenge);
  const enteredPriceTenge =
    form.priceTenge.trim() !== "" && Number.isFinite(enteredPrice)
      ? Math.round(enteredPrice)
      : null;

  const displayed =
    view === "example"
      ? {
          imageUrl: EXAMPLE_PRODUCT.imageUrl,
          productName: EXAMPLE_PRODUCT.productName,
          region: EXAMPLE_PRODUCT.region,
          priceTenge: EXAMPLE_PRODUCT.priceTenge,
          currency: "KZT" as CurrencyCode,
          output: EXAMPLE_PRODUCT.output,
          isExample: true,
          productId: undefined as string | undefined,
          editToken: undefined as string | undefined,
        }
      : view === "result" && result
        ? {
            imageUrl: result.imageUrl,
            productName: form.productName,
            region: form.region,
            priceTenge: enteredPriceTenge ?? priceFloorTenge,
            currency: form.currency,
            output: result.output,
            isExample: false,
            productId: result.id,
            editToken: result.editToken,
          }
        : null;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f2e8] text-[#201b17]">
      <header className="border-b border-black/10 bg-[#f7f2e8]/95">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <button
            type="button"
            onClick={returnToForm}
            className="flex items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f432b] focus-visible:ring-offset-4"
            aria-label="Вернуться к форме SatuKit"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-[#201b17] text-sm font-black text-white">
              S
            </span>
            <span>
              <span className="block text-base font-black tracking-tight">SatuKit</span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-black/50">
                товар говорит за вас
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={openExample}
            className="rounded-full border border-black/15 bg-white/60 px-4 py-2 text-sm font-bold transition hover:border-black/35 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f432b]"
          >
            Посмотреть пример
          </button>
        </div>
      </header>

      {displayed ? (
        <ResultView
          {...displayed}
          issues={view === "result" && result ? result.issues : []}
          copyStatus={copyStatus}
          onCopy={copyText}
          onBack={returnToForm}
          onRegenerate={() => void generate()}
          onEdited={(updated) =>
            setResult((current) => (current ? { ...current, output: updated } : current))
          }
        />
      ) : (
        <>
        <section id="create" className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-10 sm:px-8 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <div className="lg:sticky lg:top-8 lg:self-start">
            <p className="mb-5 inline-flex rounded-full border border-[#9f432b]/25 bg-[#fff8ed] px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#873821]">
              Бесплатно · RU / KK · за минуту
            </p>
            <h1 className="max-w-xl text-4xl font-black leading-[0.98] tracking-[-0.045em] sm:text-6xl">
              Фото товара → покупатели пишут вам в WhatsApp
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-black/65">
              Добавьте фото и несколько честных фактов — SatuKit соберёт продающий пост,
              сообщение WhatsApp, ответы покупателям и страничку-витрину с кнопкой.
              У SMM-специалиста такой пост стоит 5–10 тысяч тенге. Здесь — бесплатно.
            </p>

            <div className="mt-9 grid max-w-lg grid-cols-3 gap-2">
              {[
                ["01", "Фото"],
                ["02", "Факты"],
                ["03", "Тексты"],
              ].map(([number, label]) => (
                <div key={number} className="rounded-2xl border border-black/10 bg-white/45 p-3">
                  <span className="block text-xs font-black text-[#9f432b]">{number}</span>
                  <span className="mt-1 block text-sm font-bold">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={generate}
            className="rounded-[28px] border border-black/10 bg-[#fffdf8] p-5 shadow-[0_24px_80px_rgba(45,30,19,0.09)] sm:p-8"
          >
            <div className="mb-7 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-black/40">
                  Новый набор
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">Покажите товар</h2>
              </div>
              <span className="text-xs font-semibold text-black/45">* обязательно</span>
            </div>

            <div className="space-y-6">
              <div>
                <label
                  htmlFor="product-photo"
                  className="group block cursor-pointer rounded-2xl border-2 border-dashed border-black/15 bg-[#f7f2e8]/60 p-3 transition hover:border-[#9f432b]/50 focus-within:border-[#9f432b] focus-within:ring-2 focus-within:ring-[#9f432b]/20"
                >
                  <input
                    ref={fileInputRef}
                    id="product-photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    onChange={onImageChange}
                    className="sr-only"
                  />
                  {image ? (
                    <div className="relative h-60 overflow-hidden rounded-xl bg-black/5 sm:h-72">
                      <Image
                        src={image.previewUrl}
                        alt="Выбранный товар"
                        fill
                        unoptimized
                        sizes="(max-width: 1024px) 100vw, 560px"
                        className="object-cover"
                      />
                      <span className="absolute bottom-3 right-3 rounded-full bg-black/75 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
                        Заменить фото
                      </span>
                    </div>
                  ) : (
                    <div className="grid min-h-44 place-items-center px-5 py-9 text-center">
                      <div>
                        <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#9f432b] text-xl font-black text-white">
                          +
                        </span>
                        <span className="mt-4 block font-black">Добавить фото *</span>
                        <span className="mt-1 block text-sm text-black/50">
                          JPEG, PNG, WebP или HEIC · до 20 МБ · или вставьте фото (Ctrl+V)
                        </span>
                      </div>
                    </div>
                  )}
                </label>
                {resizeMessage ? (
                  <p className="mt-2 text-sm text-black/55" aria-live="polite">
                    {resizeMessage}
                  </p>
                ) : null}
              </div>

              <Field label="Название товара *" htmlFor="product-name">
                <input
                  id="product-name"
                  value={form.productName}
                  onChange={(event) => updateForm("productName", event.target.value)}
                  placeholder="Например, свеча «Ванильный вечер»"
                  required
                  className={inputClassName}
                />
              </Field>

              <Field label="Что важно знать о товаре" htmlFor="facts">
                <textarea
                  id="facts"
                  value={form.facts}
                  onChange={(event) => updateForm("facts", event.target.value)}
                  placeholder="Материал, размер, особенности. Только то, что вы можете подтвердить."
                  rows={4}
                  className={`${inputClassName} resize-y`}
                />
                <span className="mt-2 block text-xs leading-5 text-black/45">
                  Если факта здесь нет, SatuKit не должен выдавать его за правду.
                </span>
              </Field>

              <Field label="Цена для покупателя" htmlFor="price">
                <div className="flex gap-2">
                  <input
                    id="price"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    value={form.priceTenge}
                    onChange={(event) => updateForm("priceTenge", event.target.value)}
                    placeholder="8000"
                    className={`${inputClassName} flex-1`}
                  />
                  <select
                    id="currency"
                    aria-label="Валюта"
                    value={form.currency}
                    onChange={(event) => updateForm("currency", event.target.value as CurrencyCode)}
                    className={`${inputClassName} w-24 shrink-0`}
                  >
                    <option value="KZT">₸</option>
                    <option value="RUB">₽</option>
                  </select>
                </div>
                <span className="mt-2 block text-xs leading-5 text-black/45">
                  Появится на публичной карточке. Пусто — карточка выйдет без цены.
                </span>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={`Себестоимость, ${CURRENCY_SYMBOL[form.currency]}`} htmlFor="cost">
                  <input
                    id="cost"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={form.costTenge}
                    onChange={(event) => updateForm("costTenge", event.target.value)}
                    placeholder="5000"
                    className={inputClassName}
                  />
                </Field>
                <Field label="Желаемая маржа, %" htmlFor="margin">
                  <input
                    id="margin"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    max="94.99"
                    step="0.01"
                    value={form.marginPercent}
                    onChange={(event) => updateForm("marginPercent", event.target.value)}
                    placeholder="40"
                    className={inputClassName}
                  />
                </Field>
              </div>

              {priceFloorTenge !== null ? (
                <p className="-mt-3 rounded-xl bg-[#eef0df] px-4 py-3 text-sm font-bold text-[#3f4828]">
                  Не продавать дешевле {formatMoney(priceFloorTenge, form.currency)}, чтобы сохранить маржу.
                </p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Город или регион" htmlFor="region">
                  <input
                    id="region"
                    value={form.region}
                    onChange={(event) => updateForm("region", event.target.value)}
                    placeholder="Алматы"
                    className={inputClassName}
                  />
                </Field>
                <Field label="Язык результата" htmlFor="language">
                  <select
                    id="language"
                    value={form.language}
                    onChange={(event) =>
                      updateForm("language", event.target.value as Lang)
                    }
                    className={inputClassName}
                  >
                    <option value="ru">Русский</option>
                    <option value="kk">Қазақша</option>
                  </select>
                </Field>
              </div>

              {view === "error" ? (
                <div
                  role="alert"
                  className="rounded-2xl border border-[#b13b2f]/20 bg-[#fff0eb] p-4"
                >
                  <p className="font-black text-[#872d24]">Не получилось</p>
                  <p className="mt-1 text-sm leading-6 text-[#6d302b]">{errorMessage}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => (image ? void generate() : fileInputRef.current?.click())}
                      className="rounded-full bg-[#201b17] px-4 py-2 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f432b] focus-visible:ring-offset-2"
                    >
                      Попробовать снова
                    </button>
                    <button
                      type="button"
                      onClick={openExample}
                      className="rounded-full border border-black/15 px-4 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f432b]"
                    >
                      Открыть пример
                    </button>
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={view === "generating" || Boolean(resizeMessage.startsWith("Подготавливаем"))}
                className="w-full rounded-2xl bg-[#9f432b] px-5 py-4 text-base font-black text-white shadow-[0_12px_30px_rgba(159,67,43,0.25)] transition hover:bg-[#873821] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f432b] focus-visible:ring-offset-4"
              >
                {view === "generating"
                  ? "Собираем тексты и проверяем факты…"
                  : "Собрать набор для продаж"}
              </button>
              <p className="text-center text-xs leading-5 text-black/40">
                Фото уменьшается на вашем устройстве до отправки.
              </p>
            </div>
          </form>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9f432b]">
            Что внутри набора
          </p>
          <h2 className="mt-2 max-w-2xl text-3xl font-black tracking-[-0.03em] sm:text-4xl">
            Из одного фото — всё, что продаёт
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [
                "Продающий пост для Instagram",
                "Цепляющий хук, выгоды покупателя и призыв написать — готов к публикации.",
              ],
              [
                "Сообщение для WhatsApp",
                "Короткий текст для рассылки клиенткам — вставили и отправили.",
              ],
              [
                "Ответы покупателям",
                "3–5 готовых ответов на вопросы, которые задают чаще всего.",
              ],
              [
                "Подсказка цены",
                "«Не продавать дешевле X» — из вашей себестоимости и маржи. В тенге или рублях.",
              ],
              [
                "Страничка товара с кнопкой",
                "Постоянная ссылка: фото, цена, город и кнопка «Написать в WhatsApp».",
              ],
              [
                "QR для прилавка",
                "Распечатайте — покупатель на ярмарке сканирует и сразу пишет вам.",
              ],
            ].map(([title, text]) => (
              <div key={title} className="rounded-[24px] border border-black/10 bg-[#fffdf8] p-5">
                <h3 className="font-black">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-black/60">{text}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 rounded-2xl bg-[#eef0df] px-5 py-4 text-sm font-bold text-[#3f4828]">
            У SMM-специалиста один такой пост стоит 5–10 тысяч тенге. SatuKit собирает весь
            набор за минуту — бесплатно.
          </p>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9f432b]">
            Правда важнее красоты
          </p>
          <h2 className="mt-2 max-w-2xl text-3xl font-black tracking-[-0.03em] sm:text-4xl">
            Почему это не «просто нейросеть»
          </h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {[
              [
                "Только ваши факты",
                "Если вы не указали состав, доставку или гарантии — SatuKit не придумает их за вас. Всё сомнительное выносится на отдельное подтверждение.",
              ],
              [
                "Публикация под защитой",
                "Карточка не публикуется, пока в текстах остаются непроверенные утверждения. Покупатель не увидит того, за что вам пришлось бы краснеть.",
              ],
              [
                "Ничего лишнего наружу",
                "Себестоимость и маржа остаются вашими: на публичной карточке — только то, что вы решили показать.",
              ],
            ].map(([title, text]) => (
              <div key={title} className="rounded-[24px] border border-black/10 bg-white/60 p-5">
                <h3 className="font-black">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-black/60">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
          <div className="rounded-[28px] border border-black/10 bg-[#fffdf8] p-6 text-center sm:p-10">
            <h2 className="mx-auto max-w-2xl text-3xl font-black tracking-[-0.03em] sm:text-4xl">
              Как это выглядит у покупателя
            </h2>
            <p className="mx-auto mt-3 max-w-xl leading-7 text-black/60">
              Покупатель открывает карточку, видит товар, цену и город — и пишет вам в
              WhatsApp одним нажатием.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a
                href="/p/example"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-black/15 bg-white px-6 py-3 text-sm font-black hover:bg-[#f7f2e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f432b]"
              >
                Посмотреть пример карточки
              </a>
              <a
                href="#create"
                className="rounded-full bg-[#9f432b] px-6 py-3 text-sm font-black text-white hover:bg-[#873821] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f432b] focus-visible:ring-offset-2"
              >
                Собрать свой набор
              </a>
            </div>
          </div>
          <footer className="mt-10 border-t border-black/10 pt-6 pb-4 text-center text-xs leading-6 text-black/40">
            Бесплатно, без регистрации, с телефона. Сделано за 63 часа на хакатоне nFactorial
            «Startup Platform» — для сферы партнёра EmpoWomen (APEC Training Centre &amp; ASMAR
            при поддержке Chevron).
          </footer>
        </section>
        </>
      )}
    </main>
  );
}

const inputClassName =
  "w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-base text-[#201b17] placeholder:text-black/30 focus:border-[#9f432b] focus:outline-none focus:ring-2 focus:ring-[#9f432b]/20";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-2 block text-sm font-black">{label}</span>
      {children}
    </label>
  );
}

function ResultView({
  imageUrl,
  productName,
  region,
  priceTenge,
  currency,
  output,
  isExample,
  productId,
  editToken,
  issues,
  copyStatus,
  onCopy,
  onBack,
  onRegenerate,
  onEdited,
}: {
  imageUrl: string;
  productName: string;
  region: string;
  priceTenge: number | null;
  currency: CurrencyCode;
  output: AiOutput;
  isExample: boolean;
  productId?: string;
  editToken?: string;
  issues: string[];
  copyStatus: string;
  onCopy: (label: string, text: string) => Promise<void>;
  onBack: () => void;
  onRegenerate: () => void;
  onEdited: (updated: AiOutput) => void;
}) {
  const kitText = [
    output.headline,
    "",
    "Пост для Instagram:",
    output.instagram_caption,
    "",
    "Сообщение для WhatsApp:",
    output.whatsapp_message,
  ].join("\n");

  async function shareKit() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ text: kitText });
        return;
      } catch (error) {
        if ((error as DOMException)?.name === "AbortError") return;
        // share sheet unavailable — fall through to copying
      }
    }
    await onCopy("Весь набор", kitText);
  }

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [draft, setDraft] = useState({
    headline: "",
    description: "",
    instagram_caption: "",
    whatsapp_message: "",
  });

  function startEditing() {
    setDraft({
      headline: output.headline,
      description: output.description,
      instagram_caption: output.instagram_caption,
      whatsapp_message: output.whatsapp_message,
    });
    setEditError("");
    setEditing(true);
  }

  async function saveEdits() {
    if (!productId || !editToken) return;
    setSaving(true);
    setEditError("");
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editToken, fields: draft }),
      });
      if (!response.ok) throw new Error("patch failed");
      onEdited({ ...output, ...draft });
      setEditing(false);
    } catch {
      setEditError("Не удалось сохранить. Проверьте интернет и попробуйте ещё раз.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-9 sm:px-8 sm:py-14">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {isExample ? (
              <span className="rounded-full bg-[#eef0df] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#4f592f]">
                Пример
              </span>
            ) : (
              <span className="rounded-full bg-[#e8f0e8] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#34513a]">
                Набор готов
              </span>
            )}
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-5xl">
            {productName}
          </h1>
          <p className="mt-2 text-black/50">
            {[region, priceTenge ? formatMoney(priceTenge, currency) : ""].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void shareKit()}
            className="rounded-full bg-[#9f432b] px-4 py-2.5 text-sm font-black text-white hover:bg-[#873821] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f432b] focus-visible:ring-offset-2"
          >
            Поделиться
          </button>
          <button
            type="button"
            onClick={() => void onCopy("Весь набор", kitText)}
            className="rounded-full bg-[#201b17] px-4 py-2.5 text-sm font-black text-white hover:bg-[#3c332d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f432b] focus-visible:ring-offset-2"
          >
            Скопировать всё
          </button>
          {!isExample && productId && editToken ? (
            <button
              type="button"
              onClick={startEditing}
              className="rounded-full border border-black/15 bg-white/60 px-4 py-2.5 text-sm font-black hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f432b]"
            >
              Редактировать
            </button>
          ) : null}
          {!isExample ? (
            <button
              type="button"
              onClick={onRegenerate}
              className="rounded-full bg-[#201b17] px-4 py-2.5 text-sm font-black text-white hover:bg-[#3c332d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f432b] focus-visible:ring-offset-2"
            >
              Собрать заново
            </button>
          ) : null}
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-black/15 bg-white/60 px-4 py-2.5 text-sm font-black hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f432b]"
          >
            {isExample ? "Вернуться к своему товару" : "Новый товар"}
          </button>
        </div>
      </div>

      {copyStatus ? (
        <p
          role="status"
          className="mb-5 rounded-xl border border-black/10 bg-white/70 px-4 py-3 text-sm font-bold"
        >
          {copyStatus}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="overflow-hidden rounded-[26px] border border-black/10 bg-white shadow-sm lg:sticky lg:top-8 lg:self-start">
          <div className="relative aspect-[4/5] w-full">
            <Image
              src={imageUrl}
              alt={output.image_alt_text}
              fill
              unoptimized
              sizes="(max-width: 1024px) 100vw, 440px"
              className="object-cover"
            />
          </div>
          <div className="p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9f432b]">
              Главный оффер
            </p>
            <h2 className="mt-2 text-2xl font-black leading-tight">{output.headline}</h2>
            <p className="mt-3 text-sm leading-6 text-black/60">{output.description}</p>
          </div>
        </div>

        <div className="space-y-5">
          {editing ? (
            <section className="rounded-[24px] border border-[#9f432b]/25 bg-[#fff8ed] p-5 sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9f432b]">
                Редактирование
              </p>
              <div className="mt-4 space-y-4">
                <Field label="Заголовок" htmlFor="edit-headline">
                  <input
                    id="edit-headline"
                    value={draft.headline}
                    onChange={(event) => setDraft({ ...draft, headline: event.target.value })}
                    className={inputClassName}
                  />
                </Field>
                <Field label="Описание" htmlFor="edit-description">
                  <textarea
                    id="edit-description"
                    rows={4}
                    value={draft.description}
                    onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                    className={`${inputClassName} resize-y`}
                  />
                </Field>
                <Field label="Пост для Instagram" htmlFor="edit-instagram">
                  <textarea
                    id="edit-instagram"
                    rows={6}
                    value={draft.instagram_caption}
                    onChange={(event) =>
                      setDraft({ ...draft, instagram_caption: event.target.value })
                    }
                    className={`${inputClassName} resize-y`}
                  />
                </Field>
                <Field label="Сообщение для WhatsApp" htmlFor="edit-whatsapp">
                  <textarea
                    id="edit-whatsapp"
                    rows={4}
                    value={draft.whatsapp_message}
                    onChange={(event) =>
                      setDraft({ ...draft, whatsapp_message: event.target.value })
                    }
                    className={`${inputClassName} resize-y`}
                  />
                </Field>
              </div>
              {editError ? (
                <p
                  role="alert"
                  className="mt-3 rounded-xl border border-[#b13b2f]/20 bg-[#fff0eb] px-4 py-3 text-sm leading-6 text-[#6d302b]"
                >
                  {editError}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveEdits()}
                  className="rounded-full bg-[#9f432b] px-5 py-2.5 text-sm font-black text-white hover:bg-[#873821] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f432b] focus-visible:ring-offset-2"
                >
                  {saving ? "Сохраняем…" : "Сохранить"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-full border border-black/15 px-5 py-2.5 text-sm font-black hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f432b]"
                >
                  Отмена
                </button>
              </div>
            </section>
          ) : null}
          <CopyCard
            eyebrow="Instagram"
            title="Готовый пост"
            text={output.instagram_caption}
            onCopy={() => onCopy("Пост Instagram", output.instagram_caption)}
          />
          <CopyCard
            eyebrow="WhatsApp"
            title="Сообщение покупателю"
            text={output.whatsapp_message}
            onCopy={() => {
              if (!isExample && productId) track("whatsapp_clicked", productId);
              return onCopy("Сообщение WhatsApp", output.whatsapp_message);
            }}
          />

          <section className="rounded-[24px] border border-black/10 bg-[#fffdf8] p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9f432b]">
              Ответы без паузы
            </p>
            <h2 className="mt-2 text-xl font-black">Что спросит покупатель</h2>
            <div className="mt-5 divide-y divide-black/10">
              {output.buyer_faq.map((item) => (
                <div key={item.question} className="py-4 first:pt-0 last:pb-0">
                  <h3 className="font-black">{item.question}</h3>
                  <p className="mt-1 text-sm leading-6 text-black/60">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-5 sm:grid-cols-2">
            <div className="rounded-[24px] border border-black/10 bg-[#eef0df] p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#596137]">
                Как показать
              </p>
              <ol className="mt-4 space-y-3">
                {output.presentation_tips.map((tip, index) => (
                  <li key={tip} className="flex gap-3 text-sm leading-6">
                    <span className="font-black text-[#596137]">{index + 1}.</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-[24px] border border-black/10 bg-[#f3e8de] p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#873821]">
                Проверка фактов
              </p>
              {output.confirmation_required.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {output.confirmation_required.map((item) => (
                    <li key={item.claim} className="text-sm leading-6">
                      <span className="font-black">{item.claim}</span>
                      <span className="block text-black/55">{item.reason}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm leading-6 text-black/60">
                  В публичном тексте нет утверждений, которые требуют вашего подтверждения.
                </p>
              )}
            </div>
          </section>

          {!isExample && productId && editToken ? (
            <>
              {issues.length > 0 ? (
                <section
                  role="alert"
                  className="rounded-[24px] border border-[#b13b2f]/25 bg-[#fff0eb] p-5 sm:p-6"
                >
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#872d24]">
                    Публикация закрыта
                  </p>
                  <h2 className="mt-2 text-xl font-black">Мы не уверены в части текста</h2>
                  <ul className="mt-4 list-disc space-y-1 pl-5 text-sm leading-6 text-[#6d302b]">
                    {describeIssuesRu(issues).map((label) => (
                      <li key={label}>{label}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm leading-6 text-black/60">
                    Тексты выше можно копировать и править вручную, но карточка не публикуется,
                    пока факты не в порядке. Обычно помогает «Собрать заново».
                  </p>
                  <button
                    type="button"
                    onClick={onRegenerate}
                    className="mt-4 rounded-full bg-[#201b17] px-5 py-2.5 text-sm font-black text-white hover:bg-[#3c332d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f432b] focus-visible:ring-offset-2"
                  >
                    Собрать заново
                  </button>
                </section>
              ) : (
                <PublishSection
                  productId={productId}
                  editToken={editToken}
                  onCopy={onCopy}
                />
              )}
              <FeedbackSection productId={productId} />
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function CopyCard({
  eyebrow,
  title,
  text,
  onCopy,
}: {
  eyebrow: string;
  title: string;
  text: string;
  onCopy: () => void;
}) {
  return (
    <section className="rounded-[24px] border border-black/10 bg-[#fffdf8] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9f432b]">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-xl font-black">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded-full bg-[#201b17] px-4 py-2 text-sm font-bold text-white hover:bg-[#3c332d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f432b] focus-visible:ring-offset-2"
        >
          Скопировать
        </button>
      </div>
      <p className="mt-5 whitespace-pre-wrap text-[15px] leading-7 text-black/70">{text}</p>
    </section>
  );
}

function PublishSection({
  productId,
  editToken,
  onCopy,
}: {
  productId: string;
  editToken: string;
  onCopy: (label: string, text: string) => Promise<void>;
}) {
  const [whatsapp, setWhatsapp] = useState("");
  const [confirmAccurate, setConfirmAccurate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!confirmAccurate) {
      setError("Отметьте, что данные верны, чтобы опубликовать.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/products/${productId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editToken, whatsapp, confirmAccurate: true }),
      });

      if (!response.ok) {
        let code = "";
        try {
          code = ((await response.json()) as { error?: string }).error ?? "";
        } catch {
          // non-JSON error body — fall through to generic messages
        }
        if (response.status === 422 && code === "issues") {
          setError(
            "Мы не уверены в части фактов — публикация закрыта. Нажмите «Собрать заново» вверху страницы и попробуйте ещё раз.",
          );
        } else if (response.status === 422) {
          setError("Проверьте номер WhatsApp — введите его в формате +7 700 123 45 67.");
        } else if (response.status === 403) {
          setError("Не удалось подтвердить владельца карточки. Создайте набор заново.");
        } else {
          setError("Не получилось опубликовать. Попробуйте ещё раз через минуту.");
        }
        return;
      }

      const payload = (await response.json()) as { slug: string; url: string };
      setPublishedUrl(payload.url);
      track("card_published", productId);
    } catch {
      setError("Нет связи с сервером. Проверьте интернет и попробуйте снова.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-[24px] border border-[#9f432b]/20 bg-[#fff8ed] p-5 sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9f432b]">
        Публикация
      </p>
      <h2 className="mt-2 text-xl font-black">Опубликовать карточку</h2>

      {publishedUrl ? (
        <div className="mt-5 space-y-4">
          <p className="text-sm leading-6 text-black/65">
            Карточка опубликована. Поделитесь ссылкой с покупателями:
          </p>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-black/10 bg-white px-4 py-3">
            <a
              href={publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("whatsapp_clicked", productId)}
              className="break-all text-sm font-bold text-[#9f432b] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f432b]"
            >
              {publishedUrl}
            </a>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onCopy("Ссылка на карточку", publishedUrl)}
              className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-bold hover:bg-[#f7f2e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f432b]"
            >
              Скопировать ссылку
            </button>
            <a
              href={publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("whatsapp_clicked", productId)}
              className="rounded-full bg-[#201b17] px-4 py-2 text-sm font-bold text-white hover:bg-[#3c332d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f432b] focus-visible:ring-offset-2"
            >
              Открыть карточку
            </a>
          </div>
        </div>
      ) : (
        <form onSubmit={publish} className="mt-5 space-y-4">
          <Field label="Номер WhatsApp для связи" htmlFor="whatsapp">
            <input
              id="whatsapp"
              type="tel"
              inputMode="tel"
              value={whatsapp}
              onChange={(event) => setWhatsapp(event.target.value)}
              placeholder="+7 700 123 45 67"
              className={inputClassName}
            />
          </Field>

          <label htmlFor="confirm-accurate" className="flex items-start gap-3">
            <input
              id="confirm-accurate"
              type="checkbox"
              checked={confirmAccurate}
              onChange={(event) => setConfirmAccurate(event.target.checked)}
              required
              className="mt-1 size-5 shrink-0 rounded border-black/30 text-[#9f432b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f432b]"
            />
            <span className="text-sm leading-6 text-black/70">
              Данные верны, опубликовать карточку.
            </span>
          </label>

          {error ? (
            <p role="alert" className="rounded-xl border border-[#b13b2f]/20 bg-[#fff0eb] px-4 py-3 text-sm leading-6 text-[#6d302b]">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || !confirmAccurate}
            className="w-full rounded-2xl bg-[#9f432b] px-5 py-3.5 text-base font-black text-white shadow-[0_12px_30px_rgba(159,67,43,0.25)] transition hover:bg-[#873821] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f432b] focus-visible:ring-offset-4"
          >
            {submitting ? "Публикуем…" : "Опубликовать карточку"}
          </button>
        </form>
      )}
    </section>
  );
}

type YesNo = "" | "yes" | "no";

function toBool(value: YesNo): boolean | undefined {
  if (value === "yes") return true;
  if (value === "no") return false;
  return undefined;
}

function FeedbackSection({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const [businessType, setBusinessType] = useState("");
  const [region, setRegion] = useState("");
  const [currentlySelling, setCurrentlySelling] = useState<YesNo>("");
  const [easeRating, setEaseRating] = useState("");
  const [usefulnessRating, setUsefulnessRating] = useState("");
  const [mostUseful, setMostUseful] = useState("");
  const [requestedImprovement, setRequestedImprovement] = useState("");
  const [assetUsed, setAssetUsed] = useState<YesNo>("");
  const [evidenceConsent, setEvidenceConsent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        product_id: productId,
        evidence_consent: evidenceConsent,
      };
      if (businessType.trim()) body.business_type = businessType.trim();
      if (region.trim()) body.region = region.trim();
      const selling = toBool(currentlySelling);
      if (selling !== undefined) body.currently_selling = selling;
      if (easeRating) body.ease_rating = Number(easeRating);
      if (usefulnessRating) body.usefulness_rating = Number(usefulnessRating);
      if (mostUseful.trim()) body.most_useful = mostUseful.trim();
      if (requestedImprovement.trim()) body.requested_improvement = requestedImprovement.trim();
      const used = toBool(assetUsed);
      if (used !== undefined) body.asset_used = used;

      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        setError("Не получилось отправить отзыв. Попробуйте ещё раз.");
        return;
      }
      setDone(true);
      track("feedback_submitted", productId);
    } catch {
      setError("Нет связи с сервером. Попробуйте позже.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <section className="rounded-[24px] border border-black/10 bg-[#eef0df] p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#4f592f]">
          Спасибо
        </p>
        <h2 className="mt-2 text-xl font-black">Отзыв получен</h2>
        <p className="mt-2 text-sm leading-6 text-black/60">
          Спасибо! Ваш ответ помогает сделать SatuKit полезнее.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[24px] border border-black/10 bg-[#fffdf8] p-5 sm:p-6">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="feedback-form"
        className="flex w-full items-center justify-between gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f432b] focus-visible:ring-offset-4"
      >
        <span>
          <span className="block text-xs font-black uppercase tracking-[0.14em] text-[#9f432b]">
            Обратная связь
          </span>
          <span className="mt-2 block text-xl font-black">Отзыв за 60 секунд</span>
        </span>
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-black/15 text-lg font-black">
          {open ? "−" : "+"}
        </span>
      </button>

      {open ? (
        <form id="feedback-form" onSubmit={submit} className="mt-6 space-y-5">
          <Field label="Чем вы торгуете" htmlFor="fb-business">
            <input
              id="fb-business"
              value={businessType}
              onChange={(event) => setBusinessType(event.target.value)}
              placeholder="Свечи ручной работы"
              className={inputClassName}
            />
          </Field>

          <Field label="Город или регион" htmlFor="fb-region">
            <input
              id="fb-region"
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              placeholder="Алматы"
              className={inputClassName}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Уже продаёте онлайн?" htmlFor="fb-selling">
              <select
                id="fb-selling"
                value={currentlySelling}
                onChange={(event) => setCurrentlySelling(event.target.value as YesNo)}
                className={inputClassName}
              >
                <option value="">Не выбрано</option>
                <option value="yes">Да</option>
                <option value="no">Нет</option>
              </select>
            </Field>
            <Field label="Использовали материалы?" htmlFor="fb-asset">
              <select
                id="fb-asset"
                value={assetUsed}
                onChange={(event) => setAssetUsed(event.target.value as YesNo)}
                className={inputClassName}
              >
                <option value="">Не выбрано</option>
                <option value="yes">Да</option>
                <option value="no">Нет</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Насколько легко? (1–5)" htmlFor="fb-ease">
              <select
                id="fb-ease"
                value={easeRating}
                onChange={(event) => setEaseRating(event.target.value)}
                className={inputClassName}
              >
                <option value="">Не выбрано</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Насколько полезно? (1–5)" htmlFor="fb-useful">
              <select
                id="fb-useful"
                value={usefulnessRating}
                onChange={(event) => setUsefulnessRating(event.target.value)}
                className={inputClassName}
              >
                <option value="">Не выбрано</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Что было полезнее всего" htmlFor="fb-most-useful">
            <textarea
              id="fb-most-useful"
              value={mostUseful}
              onChange={(event) => setMostUseful(event.target.value)}
              rows={2}
              placeholder="Например, готовый пост для Instagram"
              className={`${inputClassName} resize-y`}
            />
          </Field>

          <Field label="Что стоит улучшить" htmlFor="fb-improve">
            <textarea
              id="fb-improve"
              value={requestedImprovement}
              onChange={(event) => setRequestedImprovement(event.target.value)}
              rows={2}
              placeholder="Чего не хватило"
              className={`${inputClassName} resize-y`}
            />
          </Field>

          <label htmlFor="fb-consent" className="flex items-start gap-3">
            <input
              id="fb-consent"
              type="checkbox"
              checked={evidenceConsent}
              onChange={(event) => setEvidenceConsent(event.target.checked)}
              className="mt-1 size-5 shrink-0 rounded border-black/30 text-[#9f432b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f432b]"
            />
            <span className="text-sm leading-6 text-black/70">
              Разрешаю использовать мой отзыв как пример.
            </span>
          </label>

          {error ? (
            <p role="alert" className="rounded-xl border border-[#b13b2f]/20 bg-[#fff0eb] px-4 py-3 text-sm leading-6 text-[#6d302b]">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-[#201b17] px-5 py-3.5 text-base font-black text-white transition hover:bg-[#3c332d] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f432b] focus-visible:ring-offset-4"
          >
            {submitting ? "Отправляем…" : "Отправить отзыв"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
