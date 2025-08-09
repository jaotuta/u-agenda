export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { appendTransactionToSheet } from "@/lib/sheets";

export async function GET() {
  try {
    await appendTransactionToSheet(process.env.SPREADSHEET_ID, {
      messageId: "TEST-" + Date.now(),
      waId: "debug",
      contactName: "Debug",
      type: "Débito",
      category: "Mercado",
      amount: 12.34,
      dateBr: "08/08/2025",
      rawText: "debug sheets",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
