import { NextResponse } from "next/server";
import { EventSchema } from "@/lib/schemas";
import { insertEvent } from "@/lib/db";

export const maxDuration = 10;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = EventSchema.safeParse(body);
    if (parsed.success) {
      await insertEvent(parsed.data).catch(() => {});
    }
  } catch {
    // events must never break the client
  }
  return NextResponse.json({ ok: true });
}
