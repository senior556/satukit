import { NextResponse } from "next/server";
import { FeedbackSchema } from "@/lib/schemas";
import { insertFeedback } from "@/lib/db";

export const maxDuration = 10;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = FeedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid" }, { status: 422 });
    }
    await insertFeedback(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
