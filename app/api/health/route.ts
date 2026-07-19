import { NextResponse } from "next/server";
import { health } from "@/lib/db";

export async function GET() {
  const db = await health();
  return NextResponse.json({ ok: true, db });
}
