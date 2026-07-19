/**
 * Normalize a Kazakhstan phone number to E.164 (`+7XXXXXXXXXX`).
 * Accepts `+7…`, `8…`, and any spacing/dashes/parentheses. 11 digits total.
 * Returns null if the number is not a valid KZ 11-digit number.
 */
export function toE164(raw: string, _defaultCountry: "KZ" = "KZ"): string | null {
  if (!raw || typeof raw !== "string") return null;

  let digits = raw.replace(/\D/g, "");

  // Local trunk-prefix form: 8XXXXXXXXXX -> 7XXXXXXXXXX
  if (digits.length === 11 && digits.startsWith("8")) {
    digits = "7" + digits.slice(1);
  }

  if (digits.length === 11 && digits.startsWith("7")) {
    return "+" + digits;
  }

  return null;
}

/**
 * Build a wa.me deep link. Strips the leading `+` from the E.164 number and
 * URL-encodes the prefilled message.
 */
export function waLink(e164: string, message: string): string {
  const digits = e164.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
