// Usage: node scripts/update-example-number.mjs +77001234567
// Sets the WhatsApp number on the /p/example card (reads .env.local for Supabase creds).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const raw = process.argv[2] ?? "";
const e164 = raw.replace(/[\s()-]/g, "");
if (!/^\+7\d{10}$/.test(e164)) {
  console.error("Передай настоящий номер: node scripts/update-example-number.mjs +77001234567");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { error, count } = await db
  .from("products")
  .update({ whatsapp_e164: e164 }, { count: "exact" })
  .eq("public_slug", "example");

if (error) {
  console.error(error);
  process.exit(1);
}
console.log(`Готово: карточка /p/example теперь ведёт на ${e164} (строк обновлено: ${count}).`);
