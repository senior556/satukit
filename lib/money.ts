import type { CurrencyCode } from "./schemas";

export const CURRENCY_SYMBOL: Record<CurrencyCode, string> = { KZT: "₸", RUB: "₽" };

export function formatMoney(value: number, currency: CurrencyCode): string {
  return `${new Intl.NumberFormat("ru-KZ").format(value)} ${CURRENCY_SYMBOL[currency]}`;
}
