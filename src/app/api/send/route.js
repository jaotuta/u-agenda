import { NextResponse } from "next/server";
import { waSendText } from "@/lib/whatsapp";

export async function POST(req) {
  const { to, text } = await req.json();
  if (!to || !text) {
    return NextResponse.json({ error: "to e text são obrigatórios" }, { status: 400 });
  }
  try {
    const data = await waSendText(to, text);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "send failed" }, { status: 500 });
  }
}